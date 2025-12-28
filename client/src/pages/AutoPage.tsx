import React, { useState, useEffect } from 'react';
import { Play, Pause, User, Check, Coffee, AlertCircle, Calendar, Bot, LogOut } from 'lucide-react';
import clsx from 'clsx';
import AutonomousInteraction from '../components/AutonomousInteraction';
import { useRobotStore } from '../store/robot.store';
import { supabase } from '../services/supabase';

// Unified Interface
interface MenuItem {
    drink_id: string;
    drink_name: string;

    // Inventory Data (Nullable if not yet stocked)
    inventory_id: string | null;
    current_quantity: number;

    // Limits (from event_drinks)
    initial_quantity: number;
}

interface EventOption {
    id: string;
    name: string;
    description: string;
    event_type: string;
}

// Map some icons based on name for visual flair
const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('water')) return '💧';
    if (n.includes('coffee') || n.includes('latte')) return '☕';
    if (n.includes('soda') || n.includes('cola')) return '🥤';
    if (n.includes('juice') || n.includes('orange')) return '🧃';
    if (n.includes('tea')) return '🍵';
    return '🥛';
};

const AutoPage: React.FC = () => {
    const {
        isAutonomous, setAutonomous,
        activeEventId: selectedEventId, setActiveEventId: setSelectedEventId,
        activeRobot: currentRobot, setActiveRobot: setCurrentRobot,
        interactionState, setInteractionState,
        selectedRobotId // Get selected robot from header dropdown
    } = useRobotStore();

    // Context Selection
    const [events, setEvents] = useState<EventOption[]>([]);

    const [selectedAction, setSelectedAction] = useState<'TAKE' | 'ADD' | null>(null);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    const [showRefillModal, setShowRefillModal] = useState(false);
    const [refillAmount, setRefillAmount] = useState<number>(1);
    const [pendingRefillItem, setPendingRefillItem] = useState<MenuItem | null>(null);

    useEffect(() => {
        fetchEvents();
        fetchRobots();
    }, [selectedRobotId]); // Re-fetch when selected robot changes

    useEffect(() => {
        if (interactionState === 'SELECTING_DRINK' || interactionState === 'IDLE') {
            fetchMenu();
        }
    }, [interactionState, selectedEventId]);


    const fetchEvents = async () => {
        if (!supabase) return;

        console.log('🔍 AutoPage: selectedRobotId =', selectedRobotId);

        // If a robot is selected in header, only show events assigned to that robot
        if (selectedRobotId) {
            const { data: eventRobots } = await supabase
                .from('event_robot')
                .select('event_id')
                .eq('robot_id', selectedRobotId);

            console.log('📋 Event-Robot assignments:', eventRobots);

            if (!eventRobots || eventRobots.length === 0) {
                console.warn('⚠️ No events assigned to this robot. Showing all active events as fallback.');
                // Fallback: Show all events if robot has no assignments
                const { data } = await supabase
                    .from('events')
                    .select('id, name, event_type, description')
                    .eq('status', 'active')
                    .order('created_at', { ascending: false });

                if (data) setEvents(data);
                return;
            }

            const eventIds = eventRobots.map(er => er.event_id);
            console.log('🎯 Event IDs for this robot:', eventIds);

            const { data, error } = await supabase
                .from('events')
                .select('id, name, event_type, description')
                .in('id', eventIds)
                .in('status', ['scheduled', 'active']) // Show both scheduled and active
                .order('created_at', { ascending: false });

            console.log('✅ Final events query result:', data, 'Error:', error);
            if (data) {
                console.log('📊 Setting', data.length, 'events to state');
                setEvents(data);
            } else {
                console.error('❌ No data returned from events query');
            }
        } else {
            console.log('ℹ️ No robot selected, fetching all active events');

            const { data } = await supabase
                .from('events')
                .select('id, name, event_type, description')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (data) setEvents(data);
        }
    };


    const fetchRobots = async () => {
        if (!supabase) return;
        // Logic: For now, grab the first Robot found in DB to be "Me"
        const { data } = await supabase
            .from('robots') // Changed from 'robot'
            .select('id, robot_name')
            .limit(1)
            .single();

        if (data) {
            setCurrentRobot(data);
        }
    };

    const fetchMenu = async () => {
        if (!supabase || !selectedEventId || !currentRobot) return;

        // 1. Fetch Event Menu (The "Truth" for this event)
        // event_drinks links event and drinks
        const { data: eventDrinks, error: edError } = await supabase
            .from('event_drinks')
            .select(`
                drink_id, 
                current_quantity,
                initial_quantity,
                drinks (id, name)
            `)
            .eq('event_id', selectedEventId);

        if (edError || !eventDrinks) {
            console.error(edError);
            return;
        }

        if (eventDrinks.length === 0) {
            setMenuItems([]);
            return;
        }

        const drinkIds = eventDrinks.map(ed => ed.drink_id);

        // 2. Fetch SCOPED Robot Inventory (New Table: robot_drink_stock)
        const { data: inventoryData } = await supabase
            .from('robot_drink_stock')
            .select('id, drink_id, current_quantity')
            .eq('robot_id', currentRobot.id)
            .eq('event_id', selectedEventId)
            .in('drink_id', drinkIds);

        // 3. Merge Lists
        const merged: MenuItem[] = eventDrinks.map(ed => {
            const inv = inventoryData?.find(i => i.drink_id === ed.drink_id);
            // @ts-ignore
            const drinkName = ed.drinks?.name || 'Unknown';

            return {
                drink_id: ed.drink_id,
                drink_name: drinkName,
                initial_quantity: ed.initial_quantity, // Global event limit/stock
                inventory_id: inv ? inv.id : null,
                current_quantity: inv ? inv.current_quantity : 0 // Robot's local stock
            };
        });

        setMenuItems(merged);
    };

    const toggleAuto = async () => {
        if (!selectedEventId) {
            alert("Please select an Active Event first.");
            return;
        }
        if (!currentRobot) {
            alert("No Robot ID found. Please create a robot in the database first.");
            return;
        }

        const newState = !isAutonomous;

        try {
            if (newState) {
                // Start the robot
                const response = await fetch('/api/v1/robot/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    setAutonomous(true);
                    setInteractionState('SEARCHING');
                } else {
                    console.error('Failed to start robot');
                }
            } else {
                // Stop the robot
                const response = await fetch('/api/v1/robot/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    setAutonomous(false);
                    setInteractionState('IDLE');
                } else {
                    console.error('Failed to stop robot');
                }
            }
        } catch (error) {
            console.error('Error toggling robot:', error);
        }
    };

    const handleInitialChoice = (action: 'TAKE' | 'ADD') => {
        setSelectedAction(action);
        setInteractionState('SELECTING_DRINK');
    };

    const handleDrinkSelection = async (item: MenuItem) => {
        if (selectedAction === 'ADD') {
            setPendingRefillItem(item);
            // Default fill up to some capacity, say 10 for now as 'max_quantity' on robot isn't strictly defined in UI yet
            setRefillAmount(5);
            setShowRefillModal(true);
            return;
        }

        // Ensure manual mode respects selection
        processDrinkAction(item, null);
    };

    const processDrinkAction = async (item: MenuItem, quantityToAddOverride: number | null) => {
        setSelectedItem(item);
        setInteractionState('PROCESSING');

        if (!supabase || !currentRobot) return;

        try {
            if (selectedAction === 'TAKE') {
                if (!item.inventory_id || item.current_quantity <= 0) {
                    alert("Out of stock on robot! Please restock first.");
                    setInteractionState(isAutonomous ? 'INTERACTING' : 'IDLE'); // Return to correct state
                    return;
                }

                const newQuantity = item.current_quantity - 1;

                // Optimistic UI
                setMenuItems(prev => prev.map(m => m.drink_id === item.drink_id ? { ...m, current_quantity: newQuantity } : m));
                setSelectedItem({ ...item, current_quantity: newQuantity });

                const { error } = await supabase
                    .from('robot_drink_stock')
                    .update({ current_quantity: newQuantity, updated_at: new Date().toISOString() })
                    .eq('id', item.inventory_id);

                if (error) throw error;

                // DATA LOGGING
                const { error: logError } = await supabase
                    .from('activity_log')
                    .insert({
                        event_id: selectedEventId,
                        robot_id: currentRobot.id,
                        drink_id: item.drink_id,
                        action: 'take',
                        quantity_changed: -1,
                        timestamp: new Date().toISOString(),
                        note: `Admin manually took 1 ${item.drink_name}`
                    });

                if (logError) console.error("Logging failed", logError);

            } else if (selectedAction === 'ADD') {
                const quantityToAdd = quantityToAddOverride || 1;
                const newQuantity = item.current_quantity + quantityToAdd;

                // Optimistic UI
                setMenuItems(prev => prev.map(m => m.drink_id === item.drink_id ? { ...m, current_quantity: newQuantity } : m));
                setSelectedItem({ ...item, current_quantity: newQuantity });

                // UPSERT with UNIQUE constraint
                // Always include initial_quantity - Supabase needs it for INSERT path
                // For updates, Supabase ignores it if the row exists (via onConflict)
                const upsertData: any = {
                    robot_id: currentRobot.id,
                    event_id: selectedEventId,
                    drink_id: item.drink_id,
                    current_quantity: newQuantity,
                    initial_quantity: item.initial_quantity || newQuantity, // Use existing or new value
                    max_quantity: 20,
                    updated_at: new Date().toISOString()
                };

                // Include id only for existing records to help with conflict resolution
                if (item.inventory_id) {
                    upsertData.id = item.inventory_id;
                }

                const { error } = await supabase
                    .from('robot_drink_stock')
                    .upsert(upsertData, { onConflict: 'robot_id,event_id,drink_id' }); // No spaces!

                if (error) {
                    console.error("Upsert failed", error);
                    throw error;
                }

                if (!item.inventory_id) {
                    fetchMenu(); // Refresh to get the new ID
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1500));

            setInteractionState('SERVING');
            setTimeout(async () => {
                // Send proceed command to robot so it moves to next customer
                if (isAutonomous) {
                    try {
                        await fetch('/api/v1/robot/interact', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ command: 'proceed' })
                        });
                    } catch (error) {
                        console.error('Error sending proceed command:', error);
                    }
                    setInteractionState('SEARCHING');
                } else {
                    setInteractionState('IDLE');
                }
                setSelectedAction(null);
                setSelectedItem(null);
            }, 3000);

        } catch (error: any) {
            console.error('Failed to update Supabase:', error);
            alert('Transaction failed: ' + error.message);
            fetchMenu();
            setInteractionState(isAutonomous ? 'INTERACTING' : 'IDLE');
        }
    };

    const confirmRefill = () => {
        if (pendingRefillItem && refillAmount > 0) {
            processDrinkAction(pendingRefillItem, refillAmount);
            setShowRefillModal(false);
            setPendingRefillItem(null);
        }
    };

    const handleEnd = async () => {
        // Send proceed command to robot so it moves to next customer
        try {
            await fetch('/api/v1/robot/interact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'proceed' })
            });
            setSelectedAction(null);
            setSelectedItem(null);
            // State will update via socket when robot sends new status
        } catch (error) {
            console.error('Error sending proceed command:', error);
            // Fallback: just reset UI state
            setInteractionState(isAutonomous ? 'SEARCHING' : 'IDLE');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full relative">

            {/* Refill Modal */}
            {showRefillModal && pendingRefillItem && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-2">Restock {pendingRefillItem.drink_name}</h3>
                        <p className="text-gray-400 text-sm mb-6">Current Stock on Robot: {pendingRefillItem.current_quantity}</p>

                        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Quantity to Add</label>
                        <input
                            type="number"
                            min="1"
                            value={refillAmount}
                            onChange={(e) => setRefillAmount(parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-4 text-2xl font-bold text-center text-white focus:border-blue-500 outline-none mb-6"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setShowRefillModal(false)}
                                className="py-3 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRefill}
                                className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-lg shadow-blue-900/40"
                            >
                                Confirm Restock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logic & Control Panel */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-full flex flex-col">
                    <h2 className="text-xl font-bold mb-6 flex items-center">
                        Autonomous Brain
                        {currentRobot && (
                            <span className="ml-auto text-xs bg-blue-600 px-2 py-1 rounded text-white flex items-center">
                                <Bot size={12} className="mr-1" />
                                {currentRobot.robot_name}
                            </span>
                        )}
                    </h2>

                    {/* Event Selector */}
                    <div className="mb-8">
                        <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center">
                            <Calendar size={16} className="mr-2" />
                            Active Event Context
                        </label>
                        <select
                            value={selectedEventId || ''}
                            onChange={(e) => {
                                if (isAutonomous) {
                                    alert("Stop the waiter before changing events.");
                                    return;
                                }
                                setSelectedEventId(e.target.value);
                            }}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition"
                        >
                            <option value="">-- Select Event --</option>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.name} ({ev.event_type})
                                </option>
                            ))}
                        </select>
                        {!selectedEventId && (
                            <p className="text-xs text-yellow-500 mt-2 flex items-center">
                                <AlertCircle size={12} className="mr-1" />
                                Select an event to start.
                            </p>
                        )}
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className={clsx("p-4 rounded-lg border flex items-center justify-between", interactionState === 'SEARCHING' ? "bg-blue-900/30 border-blue-500" : "bg-gray-900 border-gray-800")}>
                            <span>1. Search</span>
                            {interactionState === 'SEARCHING' && <span className="animate-pulse text-blue-400">●</span>}
                        </div>
                        <div className={clsx("p-4 rounded-lg border flex items-center justify-between", interactionState === 'APPROACHING' ? "bg-yellow-900/30 border-yellow-500" : "bg-gray-900 border-gray-800")}>
                            <span>2. Approach</span>
                            {interactionState === 'APPROACHING' && <span className="animate-pulse text-yellow-400">●</span>}
                        </div>
                        <div className={clsx("p-4 rounded-lg border flex items-center justify-between", ['INTERACTING', 'SELECTING_DRINK', 'PROCESSING'].includes(interactionState) ? "bg-purple-900/30 border-purple-500" : "bg-gray-900 border-gray-800")}>
                            <span>3. Interact</span>
                            {['INTERACTING', 'SELECTING_DRINK', 'PROCESSING'].includes(interactionState) && <span className="animate-pulse text-purple-400">●</span>}
                        </div>
                        <div className={clsx("p-4 rounded-lg border flex items-center justify-between", interactionState === 'SERVING' ? "bg-green-900/30 border-green-500" : "bg-gray-900 border-gray-800")}>
                            <span>4. Serve/Task</span>
                            {interactionState === 'SERVING' && <span className="animate-pulse text-green-400">●</span>}
                        </div>
                    </div>

                    <button
                        onClick={toggleAuto}
                        disabled={!selectedEventId || !currentRobot}
                        className={clsx(
                            "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all mt-8",
                            isAutonomous
                                ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/40"
                                : (!selectedEventId || !currentRobot)
                                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                    : "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/40"
                        )}
                    >
                        {isAutonomous ? <><Pause /> <span>STOP WAITER</span></> : <><Play /> <span>START WAITER</span></>}
                    </button>
                    {!currentRobot && <p className="text-center text-xs text-red-400">Error: No Robot Link Found in Database</p>}
                </div>
            </div>

            {/* Tablet Interface Preview */}
            <div className="lg:col-span-2 flex flex-col space-y-6">
                <div className="flex-1 bg-gray-900/50 rounded-xl border border-gray-700 p-8 relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute top-4 left-4 bg-gray-800 px-3 py-1 rounded-full text-xs text-gray-500 border border-gray-700">
                        ROBOT TABLET SCREEN
                    </div>
                    {selectedEventId && (
                        <div className="absolute top-4 right-4 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full text-xs text-blue-400 font-bold">
                            EVENT MODE: {events.find(e => e.id === selectedEventId)?.name.toUpperCase()}
                        </div>
                    )}

                    {!isAutonomous && currentRobot && selectedEventId && interactionState === 'IDLE' && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full text-xs text-yellow-400 font-bold animate-pulse">
                            MANUAL OVERRIDE ENABLED
                        </div>
                    )}

                    {/* Screens */}

                    {/* IDLE STATE: Manual Control - RESTOCK ONLY */}
                    {interactionState === 'IDLE' && (
                        selectedEventId ? (
                            <div className="space-y-8 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center mb-8">
                                    <h2 className="text-4xl font-bold text-white mb-2">Manual Control</h2>
                                    <p className="text-gray-400">Autonomous Mode is OFF. Staff controls enabled.</p>
                                </div>
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => handleInitialChoice('ADD')}
                                        className="w-full max-w-sm p-8 bg-blue-900/50 hover:bg-blue-800/80 border border-blue-500/30 rounded-2xl transition flex flex-col items-center gap-4 hover:scale-105 shadow-xl shadow-blue-900/20"
                                    >
                                        <Check size={48} className="text-blue-400" />
                                        <span className="font-bold text-2xl text-blue-100">Add Inventory</span>
                                        <span className="text-sm text-blue-300">Restock Drinks & Cups</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-600">
                                <h3 className="text-2xl font-bold">Waiting for Event...</h3>
                                <p>Select an Active Event to enable controls.</p>
                            </div>
                        )
                    )}

                    {(interactionState === 'SEARCHING' || interactionState === 'APPROACHING') && (
                        <div className="text-blue-400">
                            <div className="w-24 h-24 rounded-full bg-blue-500/10 mx-auto flex items-center justify-center mb-6 animate-pulse">
                                <User size={48} />
                            </div>
                            <h3 className="text-3xl font-bold text-white">Looking for customers...</h3>
                        </div>
                    )}

                    {/* INTERACTING STATE: Customer Service - TAKE ONLY */}
                    {interactionState === 'INTERACTING' && (
                        <div className="space-y-8 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-4xl font-bold text-white mb-8">Hello! How can I help?</h2>
                            <div className="grid grid-cols-2 gap-6 h-48">
                                <button
                                    onClick={() => handleInitialChoice('TAKE')}
                                    className="h-full bg-purple-600 hover:bg-purple-700 rounded-2xl transition flex flex-col items-center justify-center gap-4 hover:scale-105 shadow-xl shadow-purple-900/40"
                                >
                                    <Coffee size={48} />
                                    <span className="font-bold text-2xl">Take a Drink</span>
                                </button>

                                <button
                                    onClick={handleEnd}
                                    className="h-full bg-gray-700 hover:bg-gray-600 rounded-2xl transition flex flex-col items-center justify-center gap-4 hover:scale-105 text-gray-300 hover:text-white"
                                >
                                    <LogOut size={48} />
                                    <span className="font-bold text-xl">No thanks,<br />Goodbye</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {interactionState === 'SELECTING_DRINK' && (
                        <div className="space-y-6 w-full max-w-lg animate-in fade-in zoom-in duration-300">
                            <h2 className="text-3xl font-bold text-white">
                                {selectedAction === 'TAKE' ? "What would you like?" : "Select item to restock:"}
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {menuItems.length === 0 ? (
                                    <div className="col-span-2 p-8 text-gray-500 bg-gray-800 rounded-xl">
                                        <AlertCircle className="mx-auto mb-2" />
                                        <p>No drinks found on the menu for this event.</p>
                                    </div>
                                ) : (
                                    menuItems.map(item => (
                                        <button
                                            key={item.drink_id}
                                            onClick={() => handleDrinkSelection(item)}
                                            className={clsx(
                                                "p-6 bg-gray-800 border border-gray-700 rounded-xl transition flex items-center space-x-4 group relative overflow-hidden",
                                                (selectedAction === 'TAKE' && item.current_quantity <= 0)
                                                    ? "opacity-50 cursor-not-allowed"
                                                    : "hover:bg-gray-700 hover:border-gray-500 hover:scale-[1.02]"
                                            )}
                                        >
                                            <span className="text-2xl">
                                                {getIcon(item.drink_name)}
                                            </span>
                                            <div className="text-left">
                                                <span className="font-semibold text-lg block">{item.drink_name}</span>
                                                <span className={clsx("text-xs", item.current_quantity > 0 ? "text-green-400" : "text-red-400")}>
                                                    Stock: {item.current_quantity}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <button onClick={() => setInteractionState(isAutonomous ? 'INTERACTING' : 'IDLE')} className="text-sm text-gray-500 hover:text-white">Back</button>
                        </div>
                    )}

                    {interactionState === 'PROCESSING' && (
                        <div className="text-yellow-400 animate-pulse">
                            <p className="text-2xl font-bold">
                                {selectedAction === 'TAKE' ? "Dispensing" : "Restocking"} {selectedItem?.drink_name}...
                            </p>
                        </div>
                    )}

                    {interactionState === 'SERVING' && (
                        <div className="text-green-400">
                            <div className="w-24 h-24 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-6">
                                <Check size={48} />
                            </div>
                            <h3 className="text-3xl font-bold text-white">
                                {selectedAction === 'TAKE'
                                    ? `Here is your ${selectedItem?.drink_name}!`
                                    : `${selectedItem?.drink_name} Restocked!`}
                            </h3>
                            <p className="text-gray-400 mt-2">Current Stock: {selectedItem?.current_quantity}</p>
                            <p className="text-sm text-gray-600 mt-8">Returning to patrol in 3s...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutoPage;
