import { useEffect, useState } from 'react';
import { socket } from '../socket';
import axios from 'axios';
import { Bot, CheckCircle, XCircle, Coffee, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useRobotStore } from '../store/robot.store';
import clsx from 'clsx';

// Interface for menu items
interface MenuItem {
    drink_id: string;
    drink_name: string;
    current_quantity: number;
    inventory_id: string | null;
}

// Map drink names to icons
const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('water')) return '💧';
    if (n.includes('coffee') || n.includes('latte')) return '☕';
    if (n.includes('soda') || n.includes('cola')) return '🥤';
    if (n.includes('juice') || n.includes('orange')) return '🧃';
    if (n.includes('tea')) return '🍵';
    return '🥛';
};

export default function AutonomousInteraction() {
    const [isVisible, setIsVisible] = useState(false);
    const [interactionPhase, setInteractionPhase] = useState<'greeting' | 'selecting' | 'processing' | 'complete'>('greeting');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedDrink, setSelectedDrink] = useState<MenuItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { activeEventId, activeRobot } = useRobotStore();

    useEffect(() => {
        const handleStatus = (data: { status: string }) => {
            console.log('Robot Status Received:', data);
            if (data.status === 'waiting') {
                setIsVisible(true);
                setInteractionPhase('greeting'); // Reset to greeting when robot arrives
                setError(null);
            } else {
                setIsVisible(false);
            }
        };

        socket.on('robot_status', handleStatus);

        return () => {
            socket.off('robot_status', handleStatus);
        };
    }, []);

    // Fetch available drinks from robot inventory
    const fetchMenu = async () => {
        if (!supabase || !activeEventId || !activeRobot) {
            setError('System not ready. Please ensure an event is selected.');
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
            setMenuItems([]);
        } finally {
            setLoading(false);
        }
    };

    // Dispense drink and update database
    const dispenseDrink = async (item: MenuItem) => {
        if (!supabase || !activeEventId || !activeRobot || !item.inventory_id) {
            setError('Cannot dispense drink. System error.');
            return;
        }

        setSelectedDrink(item);
        setInteractionPhase('processing');

        try {
            // 1. Update inventory (decrement quantity)
            const { error: updateError } = await supabase
                .from('robot_drink_stock')
                .update({
                    current_quantity: item.current_quantity - 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.inventory_id);

            if (updateError) throw updateError;

            // 2. Log activity
            const { error: logError } = await supabase
                .from('activity_log')
                .insert({
                    event_id: activeEventId,
                    robot_id: activeRobot.id,
                    drink_id: item.drink_id,
                    action: 'take',
                    quantity_changed: -1,
                    timestamp: new Date().toISOString(),
                    note: 'Customer self-service via robot tablet'
                });

            if (logError) throw logError;

            // Simulate dispensing delay
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Move to complete phase
            setInteractionPhase('complete');

            // Auto-proceed after 3 seconds (PRESERVE HARDWARE CONTROL LOGIC)
            setTimeout(async () => {
                await handleProceed();
            }, 3000);

        } catch (err: any) {
            console.error('Error dispensing drink:', err);
            setError('Failed to dispense drink. Please contact staff.');
            setInteractionPhase('greeting');
        }
    };

    // Handle "Get a Drink" button
    const handleGetDrink = async () => {
        await fetchMenu();
        if (!error) {
            setInteractionPhase('selecting');
        }
    };

    // Handle drink selection
    const handleDrinkSelection = async (item: MenuItem) => {
        await dispenseDrink(item);
    };

    // Handle "Proceed" command - PRESERVE EXISTING HARDWARE CONTROL LOGIC
    const handleProceed = async () => {
        try {
            await axios.post('http://localhost:3000/api/v1/robot/interact', {
                command: 'proceed',
            });
            setIsVisible(false);
            // Reset state for next interaction
            setInteractionPhase('greeting');
            setSelectedDrink(null);
            setMenuItems([]);
            setError(null);
        } catch (err) {
            console.error('Error sending proceed command', err);
        }
    };

    // Handle "No Thanks" / Dismiss - PRESERVE EXISTING HARDWARE CONTROL LOGIC
    const handleDismiss = async () => {
        await handleProceed();
    };

    // Handle back button
    const handleBack = () => {
        setInteractionPhase('greeting');
        setError(null);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#1a1a1a] border border-gray-800 shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                        <Bot className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">WaterWaiter</h2>
                    <p className="text-blue-100">
                        {interactionPhase === 'greeting' && 'How can I help you?'}
                        {interactionPhase === 'selecting' && 'Choose your drink'}
                        {interactionPhase === 'processing' && 'Preparing...'}
                        {interactionPhase === 'complete' && 'Enjoy!'}
                    </p>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 rounded-xl bg-red-900/30 border border-red-500/30 p-4 text-center">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* GREETING PHASE */}
                    {interactionPhase === 'greeting' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="mb-6 rounded-xl bg-gray-900/50 p-4 text-center border border-gray-800">
                                <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Status</p>
                                <p className="text-white font-mono text-lg flex items-center justify-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                    READY
                                </p>
                            </div>

                            <button
                                onClick={handleGetDrink}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-4 font-bold text-white shadow-lg transition-transform hover:scale-105 hover:shadow-blue-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Coffee size={20} />
                                        Get a Drink
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleDismiss}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-transparent py-4 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                            >
                                <XCircle size={20} />
                                No Thanks
                            </button>
                        </div>
                    )}

                    {/* SELECTING PHASE */}
                    {interactionPhase === 'selecting' && (
                        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                            {menuItems.length === 0 ? (
                                <div className="text-center p-8 text-gray-500">
                                    <Coffee className="mx-auto mb-2" size={48} />
                                    <p>No drinks available</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                                    {menuItems.map((item) => (
                                        <button
                                            key={item.drink_id}
                                            onClick={() => handleDrinkSelection(item)}
                                            className={clsx(
                                                "p-4 bg-gray-800 border border-gray-700 rounded-xl transition flex flex-col items-center justify-center space-y-2",
                                                "hover:bg-gray-700 hover:border-gray-500 hover:scale-[1.02]"
                                            )}
                                        >
                                            <span className="text-3xl">{getIcon(item.drink_name)}</span>
                                            <span className="font-semibold text-sm text-center">{item.drink_name}</span>
                                            <span className="text-xs text-green-400">
                                                Stock: {item.current_quantity}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={handleBack}
                                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        </div>
                    )}

                    {/* PROCESSING PHASE */}
                    {interactionPhase === 'processing' && selectedDrink && (
                        <div className="text-center space-y-4 animate-pulse">
                            <div className="w-24 h-24 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                                <Loader2 className="animate-spin text-yellow-400" size={48} />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Dispensing</h3>
                            <p className="text-yellow-400 text-lg">{selectedDrink.drink_name}</p>
                            <p className="text-sm text-gray-500">Please wait...</p>
                        </div>
                    )}

                    {/* COMPLETE PHASE */}
                    {interactionPhase === 'complete' && selectedDrink && (
                        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-24 h-24 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="text-green-400" size={48} />
                            </div>
                            <h3 className="text-3xl font-bold text-white">Enjoy!</h3>
                            <div className="text-4xl">{getIcon(selectedDrink.drink_name)}</div>
                            <p className="text-gray-400">Here is your {selectedDrink.drink_name}</p>
                            <p className="text-sm text-gray-600 mt-8">Moving to next customer in 3s...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
