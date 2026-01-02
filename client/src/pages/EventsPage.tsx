import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, ChevronRight, MapPin, List, Bot, Pencil, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Event, DrinkList, Robot } from '../types/supabase';

const EventsPage: React.FC = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [drinkLists, setDrinkLists] = useState<DrinkList[]>([]);
    const [robots, setRobots] = useState<Robot[]>([]);
    const [, setIsLoading] = useState(false);

    // Form state - ALL event attributes
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [newEvent, setNewEvent] = useState({
        robot_ids: [] as string[], // CHANGED: Multiple robots per event
        name: '',
        event_type: '',
        description: '',
        event_date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
        location: '',
        drink_list_id: '',
        status: 'scheduled' as 'scheduled' | 'active' | 'completed' | 'cancelled',
        event_size: '',
        min_age: '',
        max_age: ''
    });
    const [conflictedRobots, setConflictedRobots] = useState<string[]>([]); // Robot IDs with date conflicts

    useEffect(() => {
        fetchEvents();
        fetchDrinkLists();
        fetchRobots();
    }, []);

    const fetchEvents = async () => {
        if (!supabase) {
            console.log('Supabase client not initialized');
            return;
        }
        setIsLoading(true);
        console.log('🔍 Fetching events...');
        const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching events:', error);
        console.log('Events fetched:', data?.length || 0, 'items', data);
        if (data) setEvents(data);
        setIsLoading(false);
    };

    const fetchDrinkLists = async () => {
        if (!supabase) {
            console.log('Supabase client not initialized');
            return;
        }
        console.log('🔍 Fetching drink lists...');
        const { data, error } = await supabase.from('drink_list').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching drink lists:', error);
        console.log('Drink lists fetched:', data?.length || 0, 'items', data);
        if (data) setDrinkLists(data);
    };

    const fetchRobots = async () => {
        if (!supabase) {
            console.log('Supabase client not initialized');
            return;
        }
        console.log('🔍 Fetching robots...');
        const { data, error } = await supabase.from('robots').select('*').order('robot_name');
        if (error) console.error('Error fetching robots:', error);
        console.log('Robots fetched:', data?.length || 0, 'items', data);
        if (data) setRobots(data);
    };

    // Check which robots have conflicts on the selected date
    const checkRobotConflicts = async (eventDate: string, excludeEventId?: string) => {
        if (!supabase || !eventDate) {
            setConflictedRobots([]);
            return;
        }

        try {
            // Find all events on the same date
            const { data: eventsOnDate, error } = await supabase
                .from('events')
                .select('id, event_date')
                .eq('event_date', eventDate)
                .neq('id', excludeEventId || ''); // Exclude current event if editing

            if (error) {
                console.error('Error checking conflicts:', error);
                return;
            }

            if (!eventsOnDate || eventsOnDate.length === 0) {
                setConflictedRobots([]);
                return;
            }

            // Get robots assigned to these events
            const eventIds = eventsOnDate.map(e => e.id);
            const { data: assignedRobots, error: robotError } = await supabase
                .from('event_robot')
                .select('robot_id')
                .in('event_id', eventIds);

            if (robotError) {
                console.error('Error fetching assigned robots:', robotError);
                return;
            }

            // Extract unique robot IDs that are conflicted
            const conflicted = [...new Set(assignedRobots?.map(r => r.robot_id) || [])];
            setConflictedRobots(conflicted);
            console.log(`🔍 Found ${conflicted.length} robots with conflicts on ${eventDate}:`, conflicted);
        } catch (err) {
            console.error('Conflict check failed:', err);
        }
    };

    // Check conflicts when date changes
    useEffect(() => {
        if (newEvent.event_date) {
            checkRobotConflicts(newEvent.event_date, editingEventId || undefined);
        }
    }, [newEvent.event_date, editingEventId]);

    const createDefaultDrinkList = async () => {
        if (!supabase) return null;
        const name = prompt("Enter a name for the new Drink List (e.g., 'Standard Menu')");
        if (!name) return null;

        const { data, error } = await supabase.from('drink_list').insert([{ name }]).select().single();
        if (error) {
            alert('Error creating drink list: ' + error.message);
            return null;
        }
        setDrinkLists(prev => [data, ...prev]);
        return data.id;
    }

    const handleCreate = async () => {
        if (!supabase) return;

        // Validation: At least one robot must be selected
        if (!newEvent.robot_ids || newEvent.robot_ids.length === 0) {
            alert('Please select at least one robot');
            return;
        }

        if (!newEvent.name) {
            alert('Event Name is required');
            return;
        }
        if (!newEvent.event_date) {
            alert('Event Date is required');
            return;
        }

        let targetListId = newEvent.drink_list_id;

        // If no drink list selected, prompt to create one
        if (!targetListId) {
            if (drinkLists.length === 0) {
                alert('No Drink Lists available. Please create one first.');
                const newId = await createDefaultDrinkList();
                if (!newId) return;
                targetListId = newId;
            } else {
                const createNew = confirm("No Drink List selected. Create a new one?");
                if (createNew) {
                    const newId = await createDefaultDrinkList();
                    if (!newId) return;
                    targetListId = newId;
                } else {
                    return;
                }
            }
        }

        // Create the event
        const { data: eventData, error: eventError } = await supabase.from('events').insert([{
            name: newEvent.name,
            event_type: newEvent.event_type || null,
            description: newEvent.description || null,
            event_date: newEvent.event_date,
            start_time: newEvent.start_time || null,
            end_time: newEvent.end_time || null,
            location: newEvent.location || null,
            drink_list_id: targetListId,
            status: newEvent.status,
            event_size: newEvent.event_size ? parseInt(newEvent.event_size) : null,
            min_age: newEvent.min_age ? parseInt(newEvent.min_age) : null,
            max_age: newEvent.max_age ? parseInt(newEvent.max_age) : null
        }]).select().single();

        if (eventError) {
            alert('Error creating event: ' + eventError.message);
            return;
        }

        // AUTO-POPULATE: Fetch all drinks from the selected drink list
        const { data: drinksInList, error: drinksError } = await supabase
            .from('drinks')
            .select('*')
            .eq('drink_list_id', targetListId);

        if (drinksError) {
            console.error('Error fetching drinks from list:', drinksError);
        } else if (drinksInList && drinksInList.length > 0) {
            // Create event_drinks entries for all drinks in the list
            const eventDrinksToCreate = drinksInList.map(drink => ({
                event_id: eventData.id,
                drink_id: drink.id,
                initial_quantity: drink.default_quantity || 0,
                current_quantity: drink.default_quantity || 0
            }));

            const { error: eventDrinksError } = await supabase
                .from('event_drinks')
                .insert(eventDrinksToCreate);

            if (eventDrinksError) {
                console.error('Error creating event drinks:', eventDrinksError);
                alert('Event created but failed to populate drinks inventory. You can add drinks manually.');
            } else {
                console.log(`Auto-populated ${drinksInList.length} drinks to event inventory`);

                // LOOP through ALL selected robots and create stock for each
                for (const robotId of newEvent.robot_ids) {
                    const robotStockEntries = drinksInList.map(drink => ({
                        robot_id: robotId,
                        event_id: eventData.id,
                        drink_id: drink.id,
                        current_quantity: 0,
                        initial_quantity: 0,
                        max_quantity: 20 // Default max per drink
                    }));

                    const { data: createdStock, error: stockError } = await supabase
                        .from('robot_drink_stock')
                        .insert(robotStockEntries)
                        .select();

                    if (stockError) {
                        console.error(`Error creating robot stock for ${robotId}:`, stockError);
                    } else {
                        console.log(`Auto-populated ${drinksInList.length} drinks to robot ${robotId} stock`);

                        // Log the initial creation of stock entries
                        if (createdStock && createdStock.length > 0) {
                            const activityLogs = createdStock.map(stock => ({
                                robot_id: stock.robot_id,
                                event_id: stock.event_id,
                                drink_id: stock.drink_id,
                                action: 'refill',
                                quantity_changed: 0,
                                note: `Initial robot stock created for event`
                            }));

                            const { error: logError } = await supabase.from('activity_log').insert(activityLogs);

                            if (logError) {
                                console.error('Failed to log robot stock creation:', logError);
                            } else {
                                console.log(`Logged ${activityLogs.length} stock creation activities for robot ${robotId}`);
                            }
                        }
                    }

                    // Link robot to event via event_robot table
                    const { error: linkError } = await supabase.from('event_robot').insert([{
                        event_id: eventData.id,
                        robot_id: robotId,
                        robot_capacity: 50  // Default capacity
                    }]);

                    if (linkError) {
                        console.error(`Error linking robot ${robotId} to event:`, linkError);
                    } else {
                        console.log(`Linked robot ${robotId} to event`);
                    }
                }
            }
        }

        // Show success message and reset form
        alert('Event created successfully! You can now manage drinks for this event.');

        fetchEvents();
        setIsCreating(false);
        setNewEvent({
            robot_ids: [],
            name: '',
            event_type: '',
            description: '',
            event_date: new Date().toISOString().split('T')[0],
            start_time: '',
            end_time: '',
            location: '',
            drink_list_id: '',
            status: 'scheduled',
            event_size: '',
            min_age: '',
            max_age: ''
        });
    };

    const handleDelete = async (id: string) => {
        if (!supabase) return;
        if (!confirm('Are you sure? This will delete the event and ALL its related data (drinks, robot assignments, inventory).')) return;

        try {
            // Step 1: Delete robot_drink_stock entries
            const { error: stockError } = await supabase
                .from('robot_drink_stock')
                .delete()
                .eq('event_id', id);

            if (stockError) console.error('Error deleting robot stock:', stockError);

            // Step 2: Delete event_drinks entries
            const { error: eventDrinksError } = await supabase
                .from('event_drinks')
                .delete()
                .eq('event_id', id);

            if (eventDrinksError) console.error('Error deleting event drinks:', eventDrinksError);

            // Step 3: Delete event_robot entries
            const { error: eventRobotError } = await supabase
                .from('event_robot')
                .delete()
                .eq('event_id', id);

            if (eventRobotError) console.error('Error deleting event robot:', eventRobotError);

            // Step 4: Delete activity_log entries (if any)
            const { error: activityError } = await supabase
                .from('activity_log')
                .delete()
                .eq('event_id', id);

            if (activityError) console.error('Error deleting activity logs:', activityError);

            // Step 5: Finally, delete the event itself
            const { error: eventError } = await supabase
                .from('events')
                .delete()
                .eq('id', id);

            if (eventError) {
                alert('Error deleting event: ' + eventError.message);
            } else {
                console.log('Event and all related data deleted successfully');
                fetchEvents();
            }
        } catch (error: any) {
            console.error('Delete operation failed:', error);
            alert('Failed to delete event: ' + error.message);
        }
    };

    const handleActivateEvent = async (eventId: string) => {
        if (!supabase) return;

        const { error } = await supabase
            .from('events')
            .update({ status: 'active' })
            .eq('id', eventId);

        if (error) {
            alert('Failed to activate event: ' + error.message);
        } else {
            alert('Event activated!');
            fetchEvents();
        }
    };

    const handleStartEdit = (event: Event) => {
        setEditingEventId(event.id);
        setIsEditing(true);
        setNewEvent({
            robot_ids: [], // Will be fetched from event_robot
            name: event.name,
            event_type: event.event_type || '',
            description: event.description || '',
            event_date: event.event_date,
            start_time: event.start_time || '',
            end_time: event.end_time || '',
            location: event.location || '',
            drink_list_id: event.drink_list_id,
            status: event.status,
            event_size: event.event_size?.toString() || '',
            min_age: event.min_age?.toString() || '',
            max_age: event.max_age?.toString() || ''
        });

        // Fetch ALL robot_ids from event_robot table
        supabase
            .from('event_robot')
            .select('robot_id')
            .eq('event_id', event.id)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const robotIds = data.map(r => r.robot_id);
                    setNewEvent(prev => ({ ...prev, robot_ids: robotIds }));
                    console.log(`📝 Editing event with ${robotIds.length} robots:`, robotIds);
                }
            });
    };

    const handleUpdate = async () => {
        if (!supabase || !editingEventId) return;
        if (!newEvent.name || !newEvent.event_date) {
            alert('Event Name and Date are required');
            return;
        }

        if (!newEvent.robot_ids || newEvent.robot_ids.length === 0) {
            alert('Please select at least one robot');
            return;
        }

        try {
            // Update the event
            const { error: eventError } = await supabase
                .from('events')
                .update({
                    name: newEvent.name,
                    event_type: newEvent.event_type || null,
                    description: newEvent.description || null,
                    event_date: newEvent.event_date,
                    start_time: newEvent.start_time || null,
                    end_time: newEvent.end_time || null,
                    location: newEvent.location || null,
                    drink_list_id: newEvent.drink_list_id,
                    status: newEvent.status,
                    event_size: newEvent.event_size ? parseInt(newEvent.event_size) : null,
                    min_age: newEvent.min_age ? parseInt(newEvent.min_age) : null,
                    max_age: newEvent.max_age ? parseInt(newEvent.max_age) : null
                })
                .eq('id', editingEventId);

            if (eventError) {
                alert('Error updating event: ' + eventError.message);
                return;
            }

            // Delete old robot assignments and stock
            await supabase.from('event_robot').delete().eq('event_id', editingEventId);
            await supabase.from('robot_drink_stock').delete().eq('event_id', editingEventId);

            // Create new robot assignments
            for (const robotId of newEvent.robot_ids) {
                await supabase.from('event_robot').insert([{
                    event_id: editingEventId,
                    robot_id: robotId,
                    robot_capacity: 50
                }]);

                // Get drinks for this event and create stock entries
                const { data: eventDrinks } = await supabase
                    .from('event_drinks')
                    .select('drink_id')
                    .eq('event_id', editingEventId);

                if (eventDrinks && eventDrinks.length > 0) {
                    const stockEntries = eventDrinks.map(ed => ({
                        robot_id: robotId,
                        event_id: editingEventId,
                        drink_id: ed.drink_id,
                        current_quantity: 0,
                        initial_quantity: 0,
                        max_quantity: 20
                    }));

                    await supabase.from('robot_drink_stock').insert(stockEntries);
                    console.log(`Created stock entries for robot ${robotId}`);
                }
            }

            fetchEvents();
            setIsEditing(false);
            setEditingEventId(null);
            setNewEvent({
                robot_ids: [],
                name: '',
                event_type: '',
                description: '',
                event_date: new Date().toISOString().split('T')[0],
                start_time: '',
                end_time: '',
                location: '',
                drink_list_id: '',
                status: 'scheduled',
                event_size: '',
                min_age: '',
                max_age: ''
            });
            console.log('Event updated successfully');
        } catch (error: any) {
            console.error('Update operation failed:', error);
            alert('Failed to update event: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div>
                    <h2 className="text-2xl font-bold">Event Management</h2>
                    <p className="text-gray-400">Plan events and assign drink menus</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition shadow-lg shadow-purple-900/40"
                >
                    <Plus size={18} />
                    <span>Create Event</span>
                </button>
            </div>

            {(isCreating || isEditing) && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-lg font-bold mb-4">{isEditing ? 'Edit Event' : 'New Event Details'}</h3>

                    {/* Step indicator */}
                    <div className="mb-6 flex items-center justify-center space-x-2 text-sm">
                        <div className={`px-3 py-1 rounded ${newEvent.robot_ids.length > 0 ? 'bg-green-600' : 'bg-gray-700'}`}>
                            1. Select Robot(s)
                        </div>
                        <div className="text-gray-500">→</div>
                        <div className={`px-3 py-1 rounded ${newEvent.name ? 'bg-green-600' : 'bg-gray-700'}`}>
                            2. Event Details
                        </div>
                        <div className="text-gray-500">→</div>
                        <div className={`px-3 py-1 rounded ${newEvent.drink_list_id ? 'bg-green-600' : 'bg-gray-700'}`}>
                            3. Drink Menu
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* STEP 1: Robot Selection - FIRST */}
                        <div className="md:col-span-2 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                            <label className="block text-sm font-semibold text-blue-400 mb-3">
                                <Bot className="inline mr-2" size={16} />
                                Step 1: Select Robot(s) - Required
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {robots.map(robot => {
                                    const isConflicted = conflictedRobots.includes(robot.id);
                                    const isSelected = newEvent.robot_ids.includes(robot.id);
                                    return (
                                        <label
                                            key={robot.id}
                                            className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${isConflicted ? 'bg-red-900/20 border-red-500/50 opacity-50 cursor-not-allowed' :
                                                isSelected ? 'bg-blue-900/40 border-blue-500' :
                                                    'bg-gray-900 border-gray-700 hover:border-blue-500/50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={isConflicted}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setNewEvent({ ...newEvent, robot_ids: [...newEvent.robot_ids, robot.id] });
                                                    } else {
                                                        setNewEvent({ ...newEvent, robot_ids: newEvent.robot_ids.filter(id => id !== robot.id) });
                                                    }
                                                }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">
                                                {robot.robot_name}
                                                {isConflicted && <span className="text-red-400 text-xs ml-2">Conflict</span>}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {robots.length === 0 && (
                                <div className="col-span-full p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                                    <p className="text-red-400 font-semibold">No robots found in database</p>
                                    <p className="text-red-300 text-sm mt-1">Please add a robot to the database before creating an event.</p>
                                </div>
                            )}
                        </div>

                        {/* STEP 2: Event Details */}
                        <input
                            placeholder="Event Name (e.g. Smith Wedding) *"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.name}
                            onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                            disabled={newEvent.robot_ids.length === 0}
                        />
                        <input
                            placeholder="Event Type (e.g. Wedding, Conference)"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.event_type}
                            onChange={e => setNewEvent({ ...newEvent, event_type: e.target.value })}
                            disabled={newEvent.robot_ids.length === 0}
                        />
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <Calendar size={16} className="text-gray-500 mr-2" />
                            <input
                                type="date"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.event_date}
                                onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                                disabled={newEvent.robot_ids.length === 0}
                            />
                        </div>

                        {/* Start and End Time */}
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <label className="text-gray-500 text-sm mr-2 whitespace-nowrap">Start:</label>
                            <input
                                type="time"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.start_time}
                                onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                disabled={newEvent.robot_ids.length === 0}
                            />
                        </div>
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <label className="text-gray-500 text-sm mr-2 whitespace-nowrap">End:</label>
                            <input
                                type="time"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.end_time}
                                onChange={e => setNewEvent({ ...newEvent, end_time: e.target.value })}
                                disabled={newEvent.robot_ids.length === 0}
                            />
                        </div>

                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <MapPin size={16} className="text-gray-500 mr-2" />
                            <input
                                placeholder="Location"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.location}
                                onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                disabled={newEvent.robot_ids.length === 0}
                            />
                        </div>

                        {/* Event Size, Min Age, Max Age */}
                        <input
                            type="number"
                            placeholder="Event Size (Expected Attendees)"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.event_size}
                            onChange={e => setNewEvent({ ...newEvent, event_size: e.target.value })}
                            disabled={newEvent.robot_ids.length === 0}
                            min="0"
                        />
                        <input
                            type="number"
                            placeholder="Minimum Age"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.min_age}
                            onChange={e => setNewEvent({ ...newEvent, min_age: e.target.value })}
                            disabled={newEvent.robot_ids.length === 0}
                            min="0"
                            max="120"
                        />
                        <input
                            type="number"
                            placeholder="Maximum Age"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.max_age}
                            onChange={e => setNewEvent({ ...newEvent, max_age: e.target.value })}
                            disabled={newEvent.robot_ids.length === 0}
                            min="0"
                            max="120"
                        />

                        {/* Event Status */}
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-400 mb-2">Event Status</label>
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white outline-none"
                                value={newEvent.status}
                                onChange={e => setNewEvent({ ...newEvent, status: e.target.value as any })}
                                disabled={newEvent.robot_ids.length === 0}
                            >
                                <option value="scheduled">Scheduled</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        {/* STEP 3: Drink List Selection */}
                        <div className="md:col-span-2 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                            <label className="block text-sm font-semibold text-purple-400 mb-2">
                                <List className="inline mr-2" size={16} />
                                Step 3: Select Drink Menu
                            </label>
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-purple-500 outline-none"
                                value={newEvent.drink_list_id}
                                onChange={e => setNewEvent({ ...newEvent, drink_list_id: e.target.value })}
                                disabled={newEvent.robot_ids.length === 0}
                            >
                                <option value="">-- Select Drink Menu (or create new below) --</option>
                                {drinkLists.map(dl => (
                                    <option key={dl.id} value={dl.id}>{dl.name}</option>
                                ))}
                            </select>
                            {drinkLists.length === 0 && (
                                <p className="text-xs text-yellow-500 mt-2">
                                    ℹ️ No drink lists yet. One will be created when you save the event.
                                </p>
                            )}
                        </div>

                        <input
                            placeholder="Description (Optional)"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white md:col-span-2"
                            value={newEvent.description}
                            onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                            disabled={newEvent.robot_ids.length === 0}
                        />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => {
                                setIsCreating(false);
                                setIsEditing(false);
                                setEditingEventId(null);
                            }}
                            className="px-4 py-2 text-gray-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={isEditing ? handleUpdate : handleCreate}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={newEvent.robot_ids.length === 0}
                        >
                            {isEditing ? 'Update Event' : 'Create & Manage Drinks →'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.length === 0 ? (
                    <div className="col-span-full text-center py-16 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
                        <Calendar size={64} className="mx-auto mb-4 text-gray-600" />
                        <h3 className="text-xl font-bold text-gray-400 mb-2">No Events Yet</h3>
                        <p className="text-gray-500 mb-4">Create your first event to get started!</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition shadow-lg shadow-purple-900/40"
                        >
                            <Plus size={18} />
                            <span>Create First Event</span>
                        </button>
                    </div>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-500/50 transition group">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                        {event.status?.toUpperCase() || 'SCHEDULED'}
                                    </span>
                                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                                        {event.status === 'scheduled' && (
                                            <button
                                                onClick={() => handleActivateEvent(event.id)}
                                                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition"
                                                title="Activate Event"
                                            >
                                                <Play size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleStartEdit(event)}
                                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition"
                                            title="Edit Event"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(event.id)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition"
                                            title="Delete Event"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold mb-1">{event.name}</h3>
                                <p className="text-sm text-purple-400 mb-2">{event.event_type}</p>

                                <div className="flex items-center text-gray-400 text-sm mb-4">
                                    <Calendar size={14} className="mr-2" />
                                    {new Date(event.event_date).toLocaleDateString()}
                                </div>
                                {event.location && (
                                    <div className="flex items-center text-gray-400 text-sm mb-4">
                                        <MapPin size={14} className="mr-2" />
                                        {event.location}
                                    </div>
                                )}
                                <p className="text-gray-500 text-sm line-clamp-2 mb-6">{event.description || 'No description'}</p>

                                <button
                                    onClick={() => navigate(`/admin/drinks?eventId=${event.id}&eventName=${encodeURIComponent(event.name)}`)}
                                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center space-x-2 text-sm font-medium transition"
                                >
                                    <span>Manage Drinks</span>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default EventsPage;
