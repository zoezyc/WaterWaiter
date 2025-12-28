import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useRobotStore } from '../store/robot.store';
import { useAuth } from '../contexts/AuthContext';
import { Coffee, Check, Loader2, ArrowLeft, Plus, Minus, LogOut } from 'lucide-react';
import { socket } from '../socket';
import clsx from 'clsx';

interface MenuItem {
    drink_id: string;
    drink_name: string;
    current_quantity: number;
    inventory_id: string | null;
}

type RobotStatus = 'idle' | 'moving' | 'waiting' | 'offering' | 'returning' | 'error' | 'serving';
type ClientPhase = 'waiting' | 'welcome' | 'selecting' | 'quantity' | 'confirm' | 'dispensing' | 'complete';

const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('water')) return '💧';
    if (n.includes('coffee') || n.includes('latte')) return '☕';
    if (n.includes('soda') || n.includes('cola')) return '🥤';
    if (n.includes('juice') || n.includes('orange')) return '🧃';
    if (n.includes('tea')) return '🍵';
    return '🥛';
};

export default function ClientTabletDashboard() {
    const [phase, setPhase] = useState<ClientPhase>('waiting');
    const [robotStatus, setRobotStatus] = useState<RobotStatus>('idle');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedDrink, setSelectedDrink] = useState<MenuItem | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { activeEventId, activeRobot, setActiveEventId, setActiveRobot } = useRobotStore();
    const { user, signOut } = useAuth();

    // Auto-detect active event/robot context if missing (Client Mode)
    useEffect(() => {
        const fetchContext = async () => {
            if (activeEventId && activeRobot) return;

            // 1. Get latest active event
            const { data: events } = await supabase
                .from('events')
                .select('id, name')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            if (events && events.length > 0) {
                const event = events[0];
                if (!activeEventId) setActiveEventId(event.id);

                // 2. Get first robot attached to this event
                if (!activeRobot) {
                    const { data: robots } = await supabase
                        .from('event_robot')
                        .select('robot:robots(id, robot_name)')
                        .eq('event_id', event.id)
                        .limit(1);

                    if (robots && robots.length > 0) {
                        const r = robots[0].robot as any;
                        if (r) setActiveRobot({ id: r.id, robot_name: r.robot_name });
                    }
                }
            }
        };

        fetchContext();
    }, [activeEventId, activeRobot]);

    // Listen to robot status via socket
    useEffect(() => {
        const onRobotStatus = (data: any) => {
            const status = data.status as RobotStatus;
            setRobotStatus(status);

            // Sync robot status to client phase
            if (status === 'idle' || status === 'returning') {
                // Robot is idle or returning - show waiting screen
                if (phase !== 'waiting' && phase !== 'dispensing' && phase !== 'complete') {
                    setPhase('waiting');
                }
            } else if (status === 'moving') {
                // Robot is searching/approaching - show waiting screen
                setPhase('waiting');
            } else if (status === 'waiting' || status === 'offering' || status === 'serving') {
                // Robot found customer and waiting - show welcome screen
                if (phase === 'waiting') {
                    setPhase('welcome');
                }
            }
        };

        socket.on('robot_status', onRobotStatus);

        return () => {
            socket.off('robot_status', onRobotStatus);
        };
    }, [phase]);

    useEffect(() => {
        if (phase === 'selecting') {
            fetchMenu();
        }
    }, [phase, activeEventId, activeRobot]);

    const fetchMenu = async () => {
        if (!supabase || !activeEventId || !activeRobot) {
            setError('System not ready. Please contact staff.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: queryError } = await supabase
                .from('robot_drink_stock')
                .select(`
                    id,
                    drink_id,
                    current_quantity,
                    drinks (id, name)
                `)
                .eq('robot_id', activeRobot.id)
                .eq('event_id', activeEventId)
                .gt('current_quantity', 0);

            if (queryError) throw queryError;

            if (!data || data.length === 0) {
                setError('No drinks available at the moment.');
                setMenuItems([]);
            } else {
                const items: MenuItem[] = data.map((item: any) => ({
                    drink_id: item.drink_id,
                    drink_name: item.drinks?.name || 'Unknown',
                    current_quantity: item.current_quantity,
                    inventory_id: item.id
                }));
                setMenuItems(items);
            }
        } catch (err: any) {
            console.error('Error fetching menu:', err);
            setError('Failed to load drinks. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDrinkSelect = (item: MenuItem) => {
        setSelectedDrink(item);
        setQuantity(1); // Reset to 1
        setPhase('quantity');
    };

    const handleQuantityConfirm = () => {
        setPhase('confirm');
    };

    const handleFinalConfirm = async () => {
        if (!selectedDrink || !supabase || !activeEventId || !activeRobot || !user) return;

        setPhase('dispensing');

        try {
            const newQuantity = selectedDrink.current_quantity - quantity;

            // 1. Update inventory - DATABASE CRUD
            const { error: updateError } = await supabase
                .from('robot_drink_stock')
                .update({
                    current_quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedDrink.inventory_id);

            if (updateError) throw updateError;

            // 2. Log activity - DATABASE CRUD
            const { error: logError } = await supabase
                .from('activity_log')
                .insert({
                    event_id: activeEventId,
                    robot_id: activeRobot.id,
                    drink_id: selectedDrink.drink_id,
                    user_id: user.id,
                    action: 'take',
                    quantity_changed: -quantity,
                    timestamp: new Date().toISOString(),
                    note: `Client took ${quantity} × ${selectedDrink.drink_name}`
                });

            if (logError) throw logError;

            // Simulate dispensing
            await new Promise(resolve => setTimeout(resolve, 3000));

            setPhase('complete');

            // Auto-reset after 5 seconds and tell robot to proceed
            setTimeout(async () => {
                try {
                    // Tell robot to move to next customer
                    await fetch('/api/v1/robot/interact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ command: 'proceed' })
                    });
                } catch (e) {
                    console.error("Failed to release robot:", e);
                }
                resetFlow();
            }, 5000);

        } catch (err: any) {
            console.error('Error dispensing:', err);
            setError('Failed to dispense. Please contact staff.');
            setPhase('welcome');
        }
    };

    const resetFlow = () => {
        setPhase('welcome');
        setSelectedDrink(null);
        setQuantity(1);
        setError(null);
    };

    const handleNoThanks = async () => {
        try {
            await fetch('/api/v1/robot/interact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'proceed' })
            });
        } catch (e) {
            console.error("Error ending interaction:", e);
        }
        resetFlow();
    };

    const incrementQuantity = () => {
        if (selectedDrink && quantity < selectedDrink.current_quantity) {
            setQuantity(quantity + 1);
        }
    };

    const decrementQuantity = () => {
        if (quantity > 1) {
            setQuantity(quantity - 1);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        WaterWaiter
                    </h1>
                    <p className="text-gray-400 text-sm">{user?.email}</p>
                </div>
                <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-2xl">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-center">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* WAITING PHASE - Robot idle/searching/approaching */}
                    {phase === 'waiting' && (
                        <div className="text-center space-y-8 animate-in fade-in duration-500">
                            <div>
                                <div className="w-32 h-32 mx-auto mb-6 bg-gray-700 rounded-full flex items-center justify-center">
                                    {robotStatus === 'moving' ? (
                                        <Loader2 size={64} className="text-blue-400 animate-spin" />
                                    ) : (
                                        <Coffee size={64} className="text-gray-500" />
                                    )}
                                </div>
                                <h2 className="text-4xl font-bold mb-4">
                                    {robotStatus === 'moving' ? 'Looking for you...' : 'Waiting...'}
                                </h2>
                                <p className="text-gray-400 text-lg">
                                    {robotStatus === 'moving'
                                        ? 'The robot is searching for customers'
                                        : 'The robot will come to you when ready'
                                    }
                                </p>
                            </div>
                        </div>
                    )}

                    {/* WELCOME PHASE */}
                    {phase === 'welcome' && (
                        <div className="text-center space-y-8 animate-in fade-in duration-500">
                            <div>
                                <div className="w-32 h-32 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                                    <Coffee size={64} className="text-blue-400" />
                                </div>
                                <h2 className="text-5xl font-bold mb-4">Welcome!</h2>
                                <p className="text-gray-400 text-xl">What would you like today?</p>
                            </div>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setPhase('selecting')}
                                    className="px-10 py-6 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl text-2xl font-bold shadow-xl hover:scale-105 transition-transform"
                                >
                                    Get a Drink
                                </button>
                                <button
                                    onClick={handleNoThanks}
                                    className="px-10 py-6 bg-gray-700/50 border border-gray-600 rounded-2xl text-2xl font-bold hover:bg-gray-700 hover:scale-105 transition-transform text-gray-300"
                                >
                                    No Thanks
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SELECTING PHASE */}
                    {phase === 'selecting' && (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            <h2 className="text-3xl font-bold text-center">Choose Your Drink</h2>
                            {loading ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-400" />
                                </div>
                            ) : menuItems.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Coffee size={64} className="mx-auto mb-4 opacity-50" />
                                    <p>No drinks available</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-6">
                                    {menuItems.map((item) => (
                                        <button
                                            key={item.drink_id}
                                            onClick={() => handleDrinkSelect(item)}
                                            className="p-8 bg-gray-800/50 border border-gray-700 rounded-2xl hover:bg-gray-700/50 hover:border-blue-500/50 transition flex flex-col items-center space-y-4"
                                        >
                                            <span className="text-6xl">{getIcon(item.drink_name)}</span>
                                            <span className="font-bold text-xl text-center">{item.drink_name}</span>
                                            <span className="text-sm text-green-400">Stock: {item.current_quantity}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={resetFlow}
                                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-white transition"
                            >
                                <ArrowLeft size={20} />
                                Back
                            </button>
                        </div>
                    )}

                    {/* QUANTITY PHASE */}
                    {phase === 'quantity' && selectedDrink && (
                        <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                            <div className="text-center">
                                <span className="text-7xl block mb-4">{getIcon(selectedDrink.drink_name)}</span>
                                <h2 className="text-3xl font-bold mb-2">{selectedDrink.drink_name}</h2>
                                <p className="text-gray-400">Available: {selectedDrink.current_quantity}</p>
                            </div>

                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
                                <label className="block text-center text-gray-400 mb-4 uppercase tracking-wider text-sm">
                                    How many?
                                </label>
                                <div className="flex items-center justify-center gap-6">
                                    <button
                                        onClick={decrementQuantity}
                                        disabled={quantity <= 1}
                                        className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-2xl font-bold transition"
                                    >
                                        <Minus />
                                    </button>
                                    <span className="text-7xl font-bold w-32 text-center">{quantity}</span>
                                    <button
                                        onClick={incrementQuantity}
                                        disabled={quantity >= selectedDrink.current_quantity}
                                        className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-2xl font-bold transition"
                                    >
                                        <Plus />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setSelectedDrink(null);
                                        setQuantity(1);
                                        setPhase('selecting');
                                    }}
                                    className="py-4 rounded-xl border border-gray-700 hover:bg-gray-800 transition flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={20} />
                                    Back
                                </button>
                                <button
                                    onClick={handleQuantityConfirm}
                                    className="py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CONFIRM PHASE */}
                    {phase === 'confirm' && selectedDrink && (
                        <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                            <div className="text-center">
                                <h2 className="text-3xl font-bold mb-8">Confirm Your Order</h2>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
                                    <span className="text-7xl block mb-4">{getIcon(selectedDrink.drink_name)}</span>
                                    <p className="text-4xl font-bold mb-2">
                                        {quantity} × {selectedDrink.drink_name}
                                    </p>
                                    <p className="text-gray-400">
                                        {quantity === 1 ? '1 drink' : `${quantity} drinks`}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setPhase('quantity')}
                                    className="py-4 rounded-xl border border-gray-700 hover:bg-gray-800 transition flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={20} />
                                    Back
                                </button>
                                <button
                                    onClick={handleFinalConfirm}
                                    className="py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                                >
                                    Confirm Order
                                </button>
                            </div>

                            <button
                                onClick={resetFlow}
                                className="w-full py-3 text-gray-500 hover:text-red-400 transition"
                            >
                                Cancel Order
                            </button>
                        </div>
                    )}

                    {/* DISPENSING PHASE */}
                    {phase === 'dispensing' && selectedDrink && (
                        <div className="text-center space-y-8 animate-pulse">
                            <div className="w-32 h-32 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                                <Loader2 className="animate-spin text-yellow-400" size={64} />
                            </div>
                            <h2 className="text-4xl font-bold">Dispensing...</h2>
                            <p className="text-2xl text-yellow-400">
                                {quantity} × {selectedDrink.drink_name}
                            </p>
                            <p className="text-gray-500">Please wait...</p>
                        </div>
                    )}

                    {/* COMPLETE PHASE */}
                    {phase === 'complete' && selectedDrink && (
                        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-24 h-24 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-6">
                                <Check size={48} className="text-green-400" />
                            </div>
                            <h2 className="text-5xl font-bold">Enjoy!</h2>
                            <div className="text-7xl">{getIcon(selectedDrink.drink_name)}</div>
                            <p className="text-2xl text-gray-400">
                                {quantity === 1 ? 'Your drink is ready' : `Your ${quantity} drinks are ready`}
                            </p>
                            <p className="text-gray-600">Returning to start...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
