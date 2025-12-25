import React, { useState, useEffect } from 'react';
import { Package, RefreshCw, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useRobotStore } from '../store/robot.store';

interface RobotStock {
    id: string;
    robot_id: string;
    drink_id: string;
    event_id: string | null;
    current_quantity: number;  // Actual SQL column
    max_quantity: number;
    initial_quantity: number;  // Actual SQL column
    robot_name?: string;
    drink_name?: string;
    event_name?: string;
}

const InventoryPage: React.FC = () => {
    const { selectedRobotId } = useRobotStore();
    const [inventory, setInventory] = useState<RobotStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState<number>(0);
    const [editMaxQuantity, setEditMaxQuantity] = useState<number>(0);

    // Track event_robot entries with their capacities (from database)
    const [eventRobotData, setEventRobotData] = useState<Record<string, { id: string, capacity: number }>>({});

    // Update capacity in database
    const updateCapacity = async (eventRobotId: string, newCapacity: number) => {
        if (!supabase || newCapacity < 1) return;

        const { error } = await supabase
            .from('event_robot')
            .update({ robot_capacity: newCapacity })
            .eq('id', eventRobotId);

        if (error) {
            console.error('Failed to update capacity:', error);
            alert('Failed to update capacity: ' + error.message);
        } else {
            const key = Object.keys(eventRobotData).find(k => eventRobotData[k].id === eventRobotId);
            if (key) {
                setEventRobotData({
                    ...eventRobotData,
                    [key]: { ...eventRobotData[key], capacity: newCapacity }
                });
            }
            console.log(`✅ Capacity updated to ${newCapacity}`);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, [selectedRobotId]);

    const fetchInventory = async () => {
        if (!supabase) return;
        setLoading(true);

        try {
            // Get active events with their robots
            const { data: eventRobots } = await supabase
                .from('event_robot')
                .select(`
                    id,
                    event_id,
                    robot_id,
                    robot_capacity,
                    events!inner(drink_list_id, name),
                    robots!inner(robot_name)
                `);

            if (!eventRobots || eventRobots.length === 0) {
                setInventory([]);
                setLoading(false);
                return;
            }

            // Filter by selected robot if specified
            const filteredEventRobots = selectedRobotId
                ? eventRobots.filter((er: any) => er.robot_id === selectedRobotId)
                : eventRobots;

            const allInventory: RobotStock[] = [];
            const capacityData: Record<string, { id: string, capacity: number }> = {};

            // For each event-robot combo, get all drinks from the event's drink list
            for (const er of filteredEventRobots) {
                const eventData = (er as any).events;
                const robotData = (er as any).robots;

                // Get all drinks in this event's drink list
                const { data: drinks } = await supabase
                    .from('drinks')
                    .select('id, name')
                    .eq('drink_list_id', eventData.drink_list_id);

                if (!drinks) continue;

                // For each drink, get or create robot_drink_stock entry
                for (const drink of drinks) {
                    let stockEntry = await supabase
                        .from('robot_drink_stock')
                        .select('*')
                        .eq('robot_id', (er as any).robot_id)
                        .eq('event_id', (er as any).event_id)
                        .eq('drink_id', drink.id)
                        .single();

                    // If no stock entry exists, create one
                    if (stockEntry.error || !stockEntry.data) {
                        const { data: newStock, error: createError } = await supabase
                            .from('robot_drink_stock')
                            .insert({
                                robot_id: (er as any).robot_id,
                                event_id: (er as any).event_id,
                                drink_id: drink.id,
                                current_quantity: 0,
                                initial_quantity: 0,
                                max_quantity: 20 // Default max per drink
                            })
                            .select()
                            .single();

                        if (!createError && newStock) {
                            stockEntry.data = newStock;

                            // Log the auto-creation
                            const { error: logError } = await supabase.from('activity_log').insert({
                                robot_id: newStock.robot_id,
                                event_id: newStock.event_id,
                                drink_id: newStock.drink_id,
                                action: 'refill',
                                quantity_changed: 0,
                                note: `Auto-created robot stock entry (Inventory page load)`
                            });

                            if (logError) {
                                console.error('❌ Failed to log stock creation:', logError);
                            } else {
                                console.log('✅ Logged stock creation');
                            }
                        }
                    }

                    if (stockEntry.data) {
                        allInventory.push({
                            ...stockEntry.data,
                            robot_name: robotData.robot_name,
                            drink_name: drink.name,
                            event_name: eventData.name
                        });
                    }
                }

                // Store event_robot capacity data
                const key = `${(er as any).robot_id}_${(er as any).event_id}`;
                capacityData[key] = {
                    id: (er as any).id,
                    capacity: (er as any).robot_capacity || 50
                };
            }

            setInventory(allInventory);
            setEventRobotData(capacityData);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStock = async (stockId: string, newQuantity: number) => {
        if (!supabase) return;
        if (newQuantity < 0) return;

        // Get current stock info before update
        const stock = inventory.find(s => s.id === stockId);
        if (!stock) return;

        const quantityChanged = newQuantity - stock.current_quantity;
        const action = quantityChanged > 0 ? 'refill' : 'take';

        const { error } = await supabase
            .from('robot_drink_stock')
            .update({ current_quantity: newQuantity })
            .eq('id', stockId);

        if (!error) {
            // Log the activity
            if (quantityChanged !== 0) {
                await supabase.from('activity_log').insert({
                    robot_id: stock.robot_id,
                    event_id: stock.event_id,
                    drink_id: stock.drink_id,
                    action: action,
                    quantity_changed: Math.abs(quantityChanged),
                    note: `Quick update (Fill button): ${stock.current_quantity} → ${newQuantity}`
                });
            }

            fetchInventory();
        } else {
            alert('Failed to update stock: ' + error.message);
        }
    };

    const syncWithEventDrinks = async () => {
        if (!supabase) return;

        try {
            // Get all event drinks with their current quantities
            const { data: eventDrinks, error: edError } = await supabase
                .from('event_drinks')
                .select('event_id, drink_id, current_quantity, initial_quantity');

            if (edError || !eventDrinks) {
                alert('Failed to fetch event drinks: ' + (edError?.message || 'Unknown error'));
                return;
            }

            // Update robot stock to match event drinks
            for (const ed of eventDrinks) {
                // Find matching robot stock entry
                const stockEntry = inventory.find(
                    s => s.event_id === ed.event_id && s.drink_id === ed.drink_id
                );

                if (stockEntry) {
                    const oldQuantity = stockEntry.current_quantity;
                    const quantityChanged = ed.current_quantity - oldQuantity;

                    await supabase
                        .from('robot_drink_stock')
                        .update({ current_quantity: ed.current_quantity })
                        .eq('id', stockEntry.id);

                    // Log the sync activity
                    if (quantityChanged !== 0) {
                        await supabase.from('activity_log').insert({
                            robot_id: stockEntry.robot_id,
                            event_id: stockEntry.event_id,
                            drink_id: stockEntry.drink_id,
                            action: quantityChanged > 0 ? 'refill' : 'take',
                            quantity_changed: Math.abs(quantityChanged),
                            note: `Synced with event drinks: ${oldQuantity} → ${ed.current_quantity}`
                        });
                    }
                }
            }

            alert('✅ Robot inventory synced with event drinks!');
            fetchInventory();
        } catch (error: any) {
            alert('Sync failed: ' + error.message);
        }
    };

    const handleStartEdit = (stock: RobotStock) => {
        setEditingStockId(stock.id);
        setEditQuantity(stock.current_quantity);
        setEditMaxQuantity(stock.max_quantity);
    };

    const handleSaveEdit = async () => {
        if (!supabase || !editingStockId) return;

        const stock = inventory.find(s => s.id === editingStockId);
        if (!stock || !stock.event_id) return;

        // Validate total capacity
        const eventInventory = inventory.filter(s => s.event_id === stock.event_id && s.robot_id === stock.robot_id);
        const currentTotalMax = eventInventory.reduce((sum, s) => sum + (s.id === editingStockId ? 0 : s.max_quantity), 0);
        const newTotalMax = currentTotalMax + editMaxQuantity;

        // Get capacity from database state
        const key = `${stock.robot_id}_${stock.event_id}`;
        const capacityLimit = eventRobotData[key]?.capacity || 50;

        if (newTotalMax > capacityLimit) {
            alert(`Cannot exceed total capacity of ${capacityLimit}! Current allocation: ${currentTotalMax}, trying to add: ${editMaxQuantity}, total would be: ${newTotalMax}`);
            return;
        }

        const quantityChanged = editQuantity - stock.current_quantity;
        const maxChanged = editMaxQuantity - stock.max_quantity;

        const { error } = await supabase
            .from('robot_drink_stock')
            .update({
                current_quantity: editQuantity,
                max_quantity: editMaxQuantity
            })
            .eq('id', editingStockId);

        if (!error) {
            // Log the activity (always log if there's any change)

            if (quantityChanged !== 0 || maxChanged !== 0) {
                // DB constraint only allows 'take' or 'refill', so use 'refill' for max-only changes
                const action = quantityChanged < 0 ? 'take' : 'refill';

                // Get current authenticated user
                const { data: { user } } = await supabase.auth.getUser();

                const { error: logError } = await supabase.from('activity_log').insert({
                    robot_id: stock.robot_id,
                    event_id: stock.event_id,
                    drink_id: stock.drink_id,
                    user_id: user?.id || null,  // Track who made the change
                    action: action,
                    quantity_changed: Math.abs(quantityChanged),
                    note: `Inventory inline edit: ${stock.current_quantity} → ${editQuantity} (max: ${stock.max_quantity} → ${editMaxQuantity})`
                });

                if (logError) {
                    console.error('❌ Failed to log activity:', logError);
                    alert('Warning: Activity log failed: ' + logError.message);
                } else {
                    console.log('✅ Activity logged successfully');
                }
            }

            setEditingStockId(null);
            setEditQuantity(0);
            setEditMaxQuantity(0);
            fetchInventory();
        } else {
            alert('Failed to update: ' + error.message);
        }
    };

    const handleCancelEdit = () => {
        setEditingStockId(null);
        setEditQuantity(0);
        setEditMaxQuantity(0);
    };

    const getStockStatus = (current: number, max: number) => {
        const percentage = (current / max) * 100;
        if (percentage <= 30) return { color: 'text-red-400 bg-red-900/20', label: 'LOW' };
        if (percentage <= 50) return { color: 'text-yellow-400 bg-yellow-900/20', label: 'MEDIUM' };
        return { color: 'text-green-400 bg-green-900/20', label: 'GOOD' };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div>
                    <h2 className="text-2xl font-bold flex items-center space-x-2">
                        <Package size={28} />
                        <span>Robot Inventory</span>
                    </h2>
                    <p className="text-gray-400 mt-1">Manage physical stock levels for each robot</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={syncWithEventDrinks} className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
                        <RefreshCw size={18} />
                        <span>Sync with Events</span>
                    </button>
                    <button onClick={fetchInventory} className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                        <RefreshCw size={18} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500">Loading inventory...</div>
            ) : inventory.length === 0 ? (
                <div className="text-center p-12 bg-gray-800 rounded-xl border border-gray-700">
                    <Package size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">No inventory data found</p>
                    <p className="text-gray-600 text-sm mt-2">Stock entries will appear here once robots are stocked</p>
                </div>
            ) : (
                <>
                    {/* Total Capacity Configuration */}
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">Robot Capacity Settings</h3>
                                <p className="text-sm text-gray-400">Configure total drink capacity per robot per event</p>
                            </div>
                            <div className="flex items-center space-x-3">
                                {Object.entries(
                                    inventory.reduce((acc, stock) => {
                                        const key = `${stock.robot_id}_${stock.event_id}`;
                                        if (!acc[key]) {
                                            acc[key] = {
                                                robot_name: stock.robot_name,
                                                event_name: stock.event_name,
                                                event_id: stock.event_id!,
                                                total_allocated: 0
                                            };
                                        }
                                        acc[key].total_allocated += stock.max_quantity;
                                        return acc;
                                    }, {} as Record<string, any>)
                                ).map(([key, data]) => (
                                    <div key={key} className="flex items-center space-x-2 bg-gray-900 px-4 py-2 rounded-lg border border-gray-700">
                                        <div className="text-sm">
                                            <span className="font-medium">{data.robot_name}</span>
                                            <span className="text-gray-500 mx-2">@</span>
                                            <span className="text-gray-400">{data.event_name}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 text-sm">Max:</span>
                                            <input
                                                type="number"
                                                value={eventRobotData[key]?.capacity ?? 50}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const numVal = val === '' ? 0 : parseInt(val);
                                                    const eventRobotId = eventRobotData[key]?.id;
                                                    if (eventRobotId) {
                                                        // Update local state immediately for UX
                                                        setEventRobotData({
                                                            ...eventRobotData,
                                                            [key]: { ...eventRobotData[key], capacity: numVal }
                                                        });
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const eventRobotId = eventRobotData[key]?.id;
                                                    if (eventRobotId) {
                                                        if (isNaN(val) || val < 1) {
                                                            updateCapacity(eventRobotId, 50);
                                                        } else {
                                                            updateCapacity(eventRobotId, val);
                                                        }
                                                    }
                                                }}
                                                className="w-16 px-2 py-1 bg-gray-950 border border-purple-500 rounded text-center text-sm"
                                                min="1"
                                            />
                                            <span className={`text-sm ${data.total_allocated > (eventRobotData[key]?.capacity || 50) ? 'text-red-400' : 'text-gray-500'}`}>
                                                / {data.total_allocated} allocated
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-700/50 border-b border-gray-700">
                                <tr>
                                    <th className="p-4 text-left font-medium">Robot</th>
                                    <th className="p-4 text-left font-medium">Drink</th>
                                    <th className="p-4 text-left font-medium">Event</th>
                                    <th className="p-4 text-center font-medium">Current</th>
                                    <th className="p-4 text-center font-medium">Max</th>
                                    <th className="p-4 text-center font-medium">Status</th>
                                    <th className="p-4 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {inventory.map((stock) => {
                                    const status = getStockStatus(stock.current_quantity, stock.max_quantity);
                                    return (
                                        <tr key={stock.id} className="hover:bg-gray-700/30 transition">
                                            <td className="p-4 font-medium">{stock.robot_name || 'Unknown'}</td>
                                            <td className="p-4">{stock.drink_name || 'Unknown'}</td>
                                            <td className="p-4 text-gray-400 text-sm">{stock.event_name || 'N/A'}</td>
                                            <td className="p-4 text-center">
                                                {editingStockId === stock.id ? (
                                                    <input
                                                        type="number"
                                                        value={editQuantity}
                                                        onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                                                        className="w-20 px-2 py-1 bg-gray-900 border border-purple-500 rounded text-center"
                                                        min="0"
                                                        max={stock.max_quantity}
                                                    />
                                                ) : (
                                                    <span className="text-lg font-bold">{stock.current_quantity}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {editingStockId === stock.id ? (
                                                    <input
                                                        type="number"
                                                        value={editMaxQuantity}
                                                        onChange={(e) => setEditMaxQuantity(parseInt(e.target.value) || 0)}
                                                        className="w-20 px-2 py-1 bg-gray-900 border border-purple-500 rounded text-center"
                                                        min="0"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400">{stock.max_quantity}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${status.color} flex items-center justify-center space-x-1`}>
                                                    {status.label === 'LOW' && <AlertTriangle size={12} />}
                                                    <span>{status.label}</span>
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-end space-x-2">
                                                    {editingStockId === stock.id ? (
                                                        <>
                                                            <button
                                                                onClick={handleSaveEdit}
                                                                className="p-2 text-green-400 hover:bg-green-900/20 rounded transition"
                                                                title="Save"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="p-2 text-red-400 hover:bg-red-900/20 rounded transition"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleStartEdit(stock)}
                                                                className="p-2 text-blue-400 hover:bg-blue-900/20 rounded transition"
                                                                title="Edit Quantity"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => updateStock(stock.id, stock.max_quantity)}
                                                                className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded transition"
                                                                title="Fill to Max"
                                                            >
                                                                Fill
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default InventoryPage;
