import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, ArrowLeft, X } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Drink, EventDrink } from '../types/supabase';

// Extend the EventDrink type to include the joined Drink data
interface EventDrinkWithDetails extends EventDrink {
    drinks: Drink | null;
}

const DrinksPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const eventId = searchParams.get('eventId');
    const eventName = searchParams.get('eventName') || 'Unknown Event';

    const [eventDrinks, setEventDrinks] = useState<EventDrinkWithDetails[]>([]);
    const [availableDrinks, setAvailableDrinks] = useState<Drink[]>([]);
    const [drinkListId, setDrinkListId] = useState<string | null>(null);

    // UI State
    const [isInternalLoading, setIsInternalLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [mode, setMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
    const [selectedDrinkId, setSelectedDrinkId] = useState('');
    const [newDrinkName, setNewDrinkName] = useState('');
    const [quantity, setQuantity] = useState(50);

    useEffect(() => {
        if (eventId) {
            fetchEventDetails();
            fetchEventDrinks();
        }
    }, [eventId]);

    const fetchEventDetails = async () => {
        if (!supabase || !eventId) return;
        const { data, error } = await supabase.from('events').select('drink_list_id').eq('id', eventId).single();

        if (error) {
            console.error("Error fetching event details:", error);
            return;
        }

        if (data && data.drink_list_id) {
            setDrinkListId(data.drink_list_id);
            fetchAvailableDrinks(data.drink_list_id);
        }
    };

    const fetchEventDrinks = async () => {
        if (!supabase || !eventId) return;
        setIsInternalLoading(true);
        // Join with the 'drinks' table now
        const { data, error } = await supabase
            .from('event_drinks')
            .select('*, drinks(*)')
            .eq('event_id', eventId);

        if (error) {
            console.error("Error fetching event drinks", error);
        }

        if (data) {
            // Supabase returns an array for joins if not mapped, but here it's singular FK?
            // drinks table: event_drinks.drink_id -> drinks.id
            setEventDrinks(data as any);
        }
        setIsInternalLoading(false);
    };

    const fetchAvailableDrinks = async (listId: string) => {
        if (!supabase) return;
        // Fetch drinks belonging to this event's drink list
        const { data } = await supabase
            .from('drinks')
            .select('*')
            .eq('drink_list_id', listId)
            .order('name');

        if (data) setAvailableDrinks(data);
    };

    const handleAddSubmit = async () => {
        if (!supabase || !eventId || !drinkListId) {
            alert("Missing event or drink list context.");
            return;
        }

        try {
            let drinkIdToLink = selectedDrinkId;

            if (mode === 'NEW') {
                if (!newDrinkName.trim()) {
                    alert("Please enter a drink name.");
                    return;
                }
                // Check dupes locally first
                const existing = availableDrinks.find(d => d.name.toLowerCase() === newDrinkName.toLowerCase());
                if (existing) {
                    if (!confirm(`Drink "${existing.name}" already exists in this list. Use it?`)) return;
                    drinkIdToLink = existing.id;
                } else {
                    // Create new drink in the drink_list
                    const { data: newType, error: createError } = await supabase
                        .from('drinks')
                        .insert([{
                            name: newDrinkName,
                            drink_list_id: drinkListId,
                            type: 'general' // valid default
                        }])
                        .select()
                        .single();

                    if (createError) throw createError;
                    drinkIdToLink = newType.id;
                }
            } else {
                if (!drinkIdToLink) {
                    alert("Please select a drink.");
                    return;
                }
            }

            // Link to Event (Create Inventory Record)
            const { error: linkError } = await supabase
                .from('event_drinks')
                .insert([{
                    event_id: eventId,
                    drink_id: drinkIdToLink,
                    initial_quantity: quantity,
                    current_quantity: quantity
                }]);

            if (linkError) {
                // Handle duplicate link constraint if exists
                if (linkError.message.includes('duplicate') || linkError.message.includes('unique')) {
                    alert("This drink is already in the event inventory.");
                } else {
                    throw linkError;
                }
            }

            // Reset and Refresh
            setIsModalOpen(false);
            setNewDrinkName('');
            setQuantity(50);
            fetchEventDrinks();
            fetchAvailableDrinks(drinkListId); // Refresh list if we added one

        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!supabase) return;
        if (!confirm("Remove this drink from the event inventory?")) return;
        const { error } = await supabase.from('event_drinks').delete().eq('id', id);
        if (!error) fetchEventDrinks();
    };

    if (!eventId) {
        return (
            <div className="text-center p-12 text-gray-500">
                <p>Please select an Event to manage its inventory.</p>
                <button onClick={() => navigate('/events')} className="mt-4 text-blue-400 hover:align-top">Go to Events</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div>
                    <button
                        onClick={() => navigate('/events')}
                        className="flex items-center text-gray-400 hover:text-white mb-2 text-sm transition"
                    >
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Events
                    </button>
                    <h2 className="text-2xl font-bold">Menu: {eventName}</h2>
                    <p className="text-gray-400">Manage drinks available at this event</p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={fetchEventDrinks} className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition">
                        <RefreshCw size={18} />
                        <span>Sync</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition shadow-lg shadow-purple-900/40"
                    >
                        <Plus size={18} />
                        <span>Add Drink</span>
                    </button>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-800 text-gray-400">
                        <tr>
                            <th className="p-4 font-medium">Drink Name</th>
                            <th className="p-4 font-medium text-center">Initial Qty</th>
                            <th className="p-4 font-medium text-center">Current Qty</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {eventDrinks.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500">No drinks assigned to this event. Add some!</td>
                            </tr>
                        ) : (
                            eventDrinks.map((ed) => (
                                <tr key={ed.id} className="hover:bg-gray-700/30 transition">
                                    <td className="p-4 font-medium">
                                        {/* @ts-ignore */}
                                        {ed.drinks?.name || 'Unknown Drink'}
                                    </td>
                                    <td className="p-4 text-center text-gray-400">
                                        {ed.initial_quantity}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${ed.current_quantity > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {ed.current_quantity}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDelete(ed.id)} className="p-2 text-gray-400 hover:text-red-400 transition hover:bg-red-900/20 rounded">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ADD DRINK MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700">
                            <h3 className="text-xl font-bold">Add Drink to Inventory</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Mode Selection */}
                            <div className="flex bg-gray-900 p-1 rounded-lg">
                                <button
                                    onClick={() => setMode('EXISTING')}
                                    className={`flex-1 py-2 rounded-md font-medium text-sm transition ${mode === 'EXISTING' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Select from List
                                </button>
                                <button
                                    onClick={() => setMode('NEW')}
                                    className={`flex-1 py-2 rounded-md font-medium text-sm transition ${mode === 'NEW' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Create New
                                </button>
                            </div>

                            {mode === 'EXISTING' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Select Drink</label>
                                    <select
                                        value={selectedDrinkId}
                                        onChange={(e) => setSelectedDrinkId(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">-- Choose a Drink --</option>
                                        {availableDrinks.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                    {availableDrinks.length === 0 && (
                                        <p className="text-xs text-yellow-500 mt-2">No drinks in this menu yet.</p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">New Drink Name</label>
                                    <input
                                        type="text"
                                        value={newDrinkName}
                                        onChange={(e) => setNewDrinkName(e.target.value)}
                                        placeholder="e.g. Orange Juice"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Will be added to the current Drink List.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Initial Quantity</label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button
                                onClick={handleAddSubmit}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-900/40"
                            >
                                Add to Inventory
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrinksPage;
