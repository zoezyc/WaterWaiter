import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useRobotStore } from '../store/robot.store';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, Minus, X, Check, Loader2, LogOut, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface MenuItem {
    drink_id: string;
    drink_name: string;
    current_quantity: number;
    max_quantity: number;
    inventory_id: string | null;
}

interface ActivityLog {
    id: string;
    action: 'take' | 'refill';
    quantity_changed: number;
    timestamp: string;
    drink_name: string;
}

export default function StaffTabletDashboard() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalAction, setModalAction] = useState<'add' | 'take' | null>(null);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [processing, setProcessing] = useState(false);

    const { activeEventId, setActiveEventId } = useRobotStore();
    const { user, signOut } = useAuth();
    const [events, setEvents] = useState<{ id: string, name: string }[]>([]);
    const [robots, setRobots] = useState<{ id: string, robot_name: string }[]>([]);
    const [selectedRobotId, setSelectedRobotId] = useState<string>('');

    useEffect(() => {
        fetchEvents();
        fetchRobots();
    }, []);

    useEffect(() => {
        if (activeEventId && selectedRobotId) {
            fetchInventory();
            fetchActivityLogs();
        }
    }, [activeEventId, selectedRobotId]);

    const fetchRobots = async () => {
        if (!supabase) return;

        try {
            const { data } = await supabase
                .from('robots')
                .select('id, robot_name')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                setRobots(data);
                // Auto-select first robot
                if (!selectedRobotId) {
                    setSelectedRobotId(data[0].id);
                }
            }
        } catch (err) {
            console.error('Error fetching robots:', err);
        }
    };

    const fetchEvents = async () => {
        if (!supabase) return;

        try {
            const { data } = await supabase
                .from('events')
                .select('id, name')
                .in('status', ['scheduled', 'active'])
                .order('created_at', { ascending: false });

            if (data) {
                setEvents(data);
                if (!activeEventId && data.length > 0) {
                    setActiveEventId(data[0].id);
                }
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    };

    const fetchInventory = async () => {
        if (!supabase || !activeEventId || !selectedRobotId) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get ONLY drinks that are assigned to THIS SPECIFIC robot for this event
            // This ensures WaterWaiter03 doesn't show Ali Birthday drinks if they're only assigned to WaterWaiter01
            const { data: robotStock, error: stockError } = await supabase
                .from('robot_drink_stock')
                .select(`
                    id,
                    drink_id,
                    current_quantity,
                    max_quantity,
                    drinks (id, name)
                `)
                .eq('robot_id', selectedRobotId)
                .eq('event_id', activeEventId);

            if (stockError) throw stockError;

            if (!robotStock || robotStock.length === 0) {
                setMenuItems([]);
                setLoading(false);
                return;
            }

            // Map to MenuItem format
            const items: MenuItem[] = robotStock.map((stock: any) => ({
                drink_id: stock.drink_id,
                drink_name: stock.drinks?.name || 'Unknown',
                current_quantity: stock.current_quantity,
                max_quantity: stock.max_quantity || 20,
                inventory_id: stock.id
            }));

            setMenuItems(items);
        } catch (err: any) {
            console.error('Error fetching inventory:', err);
            setError('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    const fetchActivityLogs = async () => {
        if (!supabase || !selectedRobotId || !activeEventId) return;

        try {
            const { data } = await supabase
                .from('activity_log')
                .select(`
                    id,
                    action,
                    quantity_changed,
                    timestamp,
                    drink_id,
                    drinks (name)
                `)
                .eq('robot_id', selectedRobotId)
                .eq('event_id', activeEventId)
                .order('timestamp', { ascending: false })
                .limit(10);

            if (data) {
                const logs: ActivityLog[] = data.map((log: any) => ({
                    id: log.id,
                    action: log.action,
                    quantity_changed: log.quantity_changed,
                    timestamp: log.timestamp,
                    drink_name: log.drinks?.name || 'Unknown'
                }));
                setActivityLogs(logs);
            }
        } catch (err) {
            console.error('Error fetching activity logs:', err);
        }
    };

    const openModal = (item: MenuItem, action: 'add' | 'take') => {
        setSelectedItem(item);
        setModalAction(action);
        setQuantity(1);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedItem(null);
        setModalAction(null);
        setQuantity(1);
    };

    const handleConfirm = async () => {
        if (!selectedItem || !supabase || !activeEventId || !selectedRobotId || !user) return;

        setProcessing(true);

        try {
            let newQuantity: number;

            if (modalAction === 'add') {
                newQuantity = selectedItem.current_quantity + quantity;

                // UPSERT inventory - DATABASE CRUD
                const { error: upsertError } = await supabase
                    .from('robot_drink_stock')
                    .upsert({
                        id: selectedItem.inventory_id || undefined,
                        robot_id: selectedRobotId,
                        event_id: activeEventId,
                        drink_id: selectedItem.drink_id,
                        current_quantity: newQuantity,
                        max_quantity: 100,
                        initial_quantity: newQuantity,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'robot_id, event_id, drink_id' });

                if (upsertError) throw upsertError;

                // Log activity - DATABASE CRUD
                const { error: logError } = await supabase
                    .from('activity_log')
                    .insert({
                        event_id: activeEventId,
                        robot_id: selectedRobotId,
                        drink_id: selectedItem.drink_id,
                        user_id: user.id,
                        action: 'refill',
                        quantity_changed: quantity,
                        timestamp: new Date().toISOString(),
                        note: `Staff added ${quantity} × ${selectedItem.drink_name}`
                    });

                if (logError) throw logError;

            } else if (modalAction === 'take') {
                if (quantity > selectedItem.current_quantity) {
                    setError('Cannot take more than available stock');
                    setProcessing(false);
                    return;
                }

                newQuantity = selectedItem.current_quantity - quantity;

                // Update inventory - DATABASE CRUD
                const { error: updateError } = await supabase
                    .from('robot_drink_stock')
                    .update({
                        current_quantity: newQuantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', selectedItem.inventory_id);

                if (updateError) throw updateError;

                // Log activity - DATABASE CRUD
                const { error: logError } = await supabase
                    .from('activity_log')
                    .insert({
                        event_id: activeEventId,
                        robot_id: selectedRobotId,
                        drink_id: selectedItem.drink_id,
                        user_id: user.id,
                        action: 'take',
                        quantity_changed: -quantity,
                        timestamp: new Date().toISOString(),
                        note: `Staff took ${quantity} × ${selectedItem.drink_name}`
                    });

                if (logError) throw logError;
            }

            // Refresh data to reflect changes
            await fetchInventory();
            await fetchActivityLogs();

            closeModal();
            setError(null);

        } catch (err: any) {
            console.error('Error updating inventory:', err);
            setError(`Failed to ${modalAction} drinks: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-gray-700 bg-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Staff Control Panel
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
                </div>

                {/* Event & Robot Selectors */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-gray-400 text-sm mb-2 block">Robot:</label>
                        <select
                            value={selectedRobotId}
                            onChange={(e) => setSelectedRobotId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 outline-none focus:border-purple-500 transition"
                        >
                            <option value="">Select Robot</option>
                            {robots.map(robot => (
                                <option key={robot.id} value={robot.id}>{robot.robot_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-gray-400 text-sm mb-2 block">Event:</label>
                        <select
                            value={activeEventId || ''}
                            onChange={(e) => setActiveEventId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 outline-none focus:border-purple-500 transition"
                        >
                            <option value="">Select Event</option>
                            {events.map(event => (
                                <option key={event.id} value={event.id}>{event.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => { fetchInventory(); fetchActivityLogs(); }}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition self-end"
                    title="Refresh"
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-6">
                {error && (
                    <div className="mb-6 bg-red-900/30 border border-red-500/30 rounded-xl p-4">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {!activeEventId || !selectedRobotId ? (
                    <div className="text-center text-gray-500 py-12">
                        <Package size={64} className="mx-auto mb-4 opacity-50" />
                        <p>Please select a robot and event to manage inventory</p>
                    </div>
                ) : loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Inventory Section */}
                        <div className="lg:col-span-2 space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Package />
                                Current Inventory
                            </h2>

                            {menuItems.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-gray-800/30 rounded-xl border border-gray-700">
                                    <p>No drinks configured for this event</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {menuItems.map((item) => (
                                        <div
                                            key={item.drink_id}
                                            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-purple-500/30 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div>
                                                        <h3 className="font-bold text-lg">{item.drink_name}</h3>
                                                        <div className="flex items-center gap-3">
                                                            <p className={clsx(
                                                                "text-sm font-mono font-bold",
                                                                item.current_quantity === 0 ? "text-red-400" :
                                                                    item.current_quantity < 5 ? "text-yellow-400" :
                                                                        "text-green-400"
                                                            )}>
                                                                {item.current_quantity} / {item.max_quantity}
                                                            </p>
                                                            <span className="text-xs text-gray-500">units</span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            Max capacity: {item.max_quantity} units
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => openModal(item, 'add')}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center gap-2 transition"
                                                    >
                                                        <Plus size={18} />
                                                        Add
                                                    </button>
                                                    <button
                                                        onClick={() => openModal(item, 'take')}
                                                        disabled={item.current_quantity === 0}
                                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center gap-2 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <Minus size={18} />
                                                        Take
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Activity Log Section */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold">Recent Activity</h2>
                            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 space-y-3 max-h-96 overflow-y-auto">
                                {activityLogs.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No recent activity</p>
                                ) : (
                                    activityLogs.map(log => (
                                        <div key={log.id} className="text-sm border-b border-gray-700/50 pb-2">
                                            <p className={clsx(
                                                "font-semibold",
                                                log.action === 'refill' ? "text-green-400" : "text-red-400"
                                            )}>
                                                {log.action === 'refill' ? '+' : ''}{log.quantity_changed} {log.drink_name}
                                            </p>
                                            <p className="text-gray-500 text-xs">{formatTimestamp(log.timestamp)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Quantity Modal */}
            {showModal && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                        <h3 className="text-2xl font-bold mb-4">
                            {modalAction === 'add' ? 'Add' : 'Take'} {selectedItem.drink_name}
                        </h3>

                        <div className="mb-6">
                            <p className="text-gray-400 text-sm mb-4">
                                Current Stock: <span className="font-bold text-white">{selectedItem.current_quantity}</span>
                            </p>

                            <label className="block text-center text-gray-400 mb-4 uppercase tracking-wider text-xs">
                                Quantity
                            </label>
                            <div className="flex items-center justify-center gap-6 mb-6">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xl font-bold transition"
                                >
                                    <Minus />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max={modalAction === 'take' ? selectedItem.current_quantity : undefined}
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                    className="w-24 text-center bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-3xl font-bold outline-none focus:border-purple-500"
                                />
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    disabled={modalAction === 'take' && quantity >= selectedItem.current_quantity}
                                    className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xl font-bold transition disabled:opacity-30"
                                >
                                    <Plus />
                                </button>
                            </div>

                            {modalAction === 'take' && quantity > selectedItem.current_quantity && (
                                <p className="text-red-400 text-sm text-center">
                                    Cannot take more than available stock
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={closeModal}
                                disabled={processing}
                                className="py-3 rounded-xl border border-gray-600 hover:bg-gray-700 transition flex items-center justify-center gap-2"
                            >
                                <X size={18} />
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={processing || (modalAction === 'take' && quantity > selectedItem.current_quantity)}
                                className={clsx(
                                    "py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50",
                                    modalAction === 'add' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                                )}
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Confirm
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
