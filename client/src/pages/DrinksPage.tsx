import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, ArrowLeft, X, Pencil, Check } from 'lucide-react';
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDrinkId, setEditingDrinkId] = useState<string | null>(null);
    const [editQuantities, setEditQuantities] = useState<{ initial: number, current: number }>({ initial: 0, current: 0 });

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

    const handleStartEdit = (drink: EventDrinkWithDetails) => {
        setEditingDrinkId(drink.id);
        setEditQuantities({
            initial: drink.initial_quantity,
            current: drink.current_quantity
        });
    };

    const handleSaveEdit = async () => {
        if (!supabase || !editingDrinkId) return;

        const { error } = await supabase
            .from('event_drinks')
            .update({
                initial_quantity: editQuantities.initial,
                current_quantity: editQuantities.current,
                updated_at: new Date().toISOString()
            })
            .eq('id', editingDrinkId);

        if (error) {
            alert('Error updating quantities: ' + error.message);
        } else {
            setEditingDrinkId(null);
            fetchEventDrinks();
            console.log('✅ Drink quantities updated');
        }
    };

    const handleCancelEdit = () => {
        setEditingDrinkId(null);
        setEditQuantities({ initial: 0, current: 0 });
    };

    // Drink List Management State (when no eventId)
    const [drinkLists, setDrinkLists] = useState<any[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [listDrinks, setListDrinks] = useState<Drink[]>([]);
    const [isListModalOpen, setIsListModalOpen] = useState(false);
    const [isDrinkModalOpen, setIsDrinkModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newDrinkForList, setNewDrinkForList] = useState({ name: '', type: '', volume: '', description: '' });

    useEffect(() => {
        if (!eventId) {
            fetchDrinkLists();
        }
    }, [eventId]);

    const fetchDrinkLists = async () => {
        if (!supabase) return;
        const { data, error } = await supabase
            .from('drink_list')
            .select('*, drinks(count)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setDrinkLists(data);
        }
    };

    const fetchListDrinks = async (listId: string) => {
        if (!supabase) return;
        const { data } = await supabase
            .from('drinks')
            .select('*')
            .eq('drink_list_id', listId)
            .order('name');

        if (data) setListDrinks(data);
    };

    const handleCreateList = async () => {
        if (!supabase || !newListName.trim()) {
            alert('Please enter a list name');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('drink_list')
            .insert([{ name: newListName, created_by: user?.id }]);

        if (!error) {
            setNewListName('');
            setIsListModalOpen(false);
            fetchDrinkLists();
        } else {
            alert('Error creating list: ' + error.message);
        }
    };

    const handleDeleteList = async (listId: string) => {
        if (!supabase || !confirm('Delete this drink list? This will also delete all drinks in it.')) return;

        const { error } = await supabase.from('drink_list').delete().eq('id', listId);
        if (!error) {
            if (selectedListId === listId) {
                setSelectedListId(null);
                setListDrinks([]);
            }
            fetchDrinkLists();
        }
    };

    const handleAddDrinkToList = async () => {
        if (!supabase || !selectedListId || !newDrinkForList.name.trim()) {
            alert('Please enter a drink name');
            return;
        }

        const { error } = await supabase
            .from('drinks')
            .insert([{
                name: newDrinkForList.name,
                type: newDrinkForList.type || 'general',
                volume: newDrinkForList.volume,
                description: newDrinkForList.description,
                drink_list_id: selectedListId
            }]);

        if (!error) {
            setNewDrinkForList({ name: '', type: '', volume: '', description: '' });
            setIsDrinkModalOpen(false);
            fetchListDrinks(selectedListId);
            fetchDrinkLists(); // Refresh count
        } else {
            alert('Error adding drink: ' + error.message);
        }
    };

    const handleDeleteDrink = async (drinkId: string) => {
        if (!supabase || !confirm('Delete this drink?')) return;

        const { error } = await supabase.from('drinks').delete().eq('id', drinkId);
        if (!error && selectedListId) {
            fetchListDrinks(selectedListId);
            fetchDrinkLists(); // Refresh count
        }
    };

    if (!eventId) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">Drink Lists Management</h2>
                            <p className="text-gray-400 mt-1">Manage your drink list templates</p>
                        </div>
                        <button
                            onClick={() => setIsListModalOpen(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                        >
                            <Plus size={18} />
                            <span>Create List</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Drink Lists */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <h3 className="font-bold mb-4">Drink Lists</h3>
                            {drinkLists.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No drink lists yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {drinkLists.map(list => (
                                        <div
                                            key={list.id}
                                            onClick={() => {
                                                setSelectedListId(list.id);
                                                fetchListDrinks(list.id);
                                            }}
                                            className={`p-3 rounded-lg cursor-pointer transition ${selectedListId === list.id
                                                    ? 'bg-purple-600'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium">{list.name}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {list.drinks?.[0]?.count || 0} drinks
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteList(list.id);
                                                    }}
                                                    className="p-1 text-red-400 hover:bg-red-900/20 rounded transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Drinks in Selected List */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            {selectedListId ? (
                                <>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold">Drinks in List</h3>
                                        <button
                                            onClick={() => setIsDrinkModalOpen(true)}
                                            className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm"
                                        >
                                            <Plus size={16} />
                                            <span>Add Drink</span>
                                        </button>
                                    </div>
                                    {listDrinks.length === 0 ? (
                                        <p className="text-gray-500 text-center py-8">No drinks in this list</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {listDrinks.map(drink => (
                                                <div
                                                    key={drink.id}
                                                    className="flex justify-between items-center p-3 bg-gray-700 rounded-lg"
                                                >
                                                    <div>
                                                        <p className="font-medium">{drink.name}</p>
                                                        <div className="flex gap-3 text-xs text-gray-400 mt-1">
                                                            {drink.type && <span>Type: {drink.type}</span>}
                                                            {drink.volume && <span>Volume: {drink.volume}</span>}
                                                        </div>
                                                        {drink.description && (
                                                            <p className="text-xs text-gray-500 mt-1">{drink.description}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteDrink(drink.id)}
                                                        className="p-2 text-red-400 hover:bg-red-900/20 rounded transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-500 text-center py-12">Select a drink list to view its drinks</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Create List Modal */}
                {isListModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Create Drink List</h3>
                                <button onClick={() => setIsListModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="List Name (e.g., Summer Menu)"
                                value={newListName}
                                onChange={e => setNewListName(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-4"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsListModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateList}
                                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Drink Modal */}
                {isDrinkModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add Drink</h3>
                                <button onClick={() => setIsDrinkModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Drink Name *"
                                    value={newDrinkForList.name}
                                    onChange={e => setNewDrinkForList({ ...newDrinkForList, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="Type (e.g., Soft Drink)"
                                    value={newDrinkForList.type}
                                    onChange={e => setNewDrinkForList({ ...newDrinkForList, type: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="Volume (e.g., 330ml)"
                                    value={newDrinkForList.volume}
                                    onChange={e => setNewDrinkForList({ ...newDrinkForList, volume: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                                />
                                <textarea
                                    placeholder="Description (optional)"
                                    value={newDrinkForList.description}
                                    onChange={e => setNewDrinkForList({ ...newDrinkForList, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                                    rows={2}
                                />
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => setIsDrinkModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddDrinkToList}
                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
                                        {editingDrinkId === ed.id ? (
                                            <input
                                                type="number"
                                                className="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-center"
                                                value={editQuantities.initial}
                                                onChange={e => setEditQuantities(prev => ({ ...prev, initial: parseInt(e.target.value) || 0 }))}
                                                min="0"
                                            />
                                        ) : (
                                            ed.initial_quantity
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {editingDrinkId === ed.id ? (
                                            <input
                                                type="number"
                                                className="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-center"
                                                value={editQuantities.current}
                                                onChange={e => setEditQuantities(prev => ({ ...prev, current: parseInt(e.target.value) || 0 }))}
                                                min="0"
                                            />
                                        ) : (
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${ed.current_quantity > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {ed.current_quantity}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {editingDrinkId === ed.id ? (
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition"
                                                    title="Save Changes"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded transition"
                                                    title="Cancel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => handleStartEdit(ed)}
                                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition"
                                                    title="Edit Quantities"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(ed.id)}
                                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition"
                                                    title="Remove from Event"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
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
