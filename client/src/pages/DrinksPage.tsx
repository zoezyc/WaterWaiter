import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const DrinksPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const eventId = searchParams.get('eventId');
    const eventName = searchParams.get('eventName') || 'Unknown Event';

    const [drinks, setDrinks] = useState<any[]>([]);

    // Check if we are in event context
    useEffect(() => {
        if (!eventId) {
            // Optional: Redirect to events if accessed directly without event?
            // For now, allow viewing "All Drinks" or show a warning
        } else {
            fetchDrinks();
        }
    }, [eventId]);

    const fetchDrinks = async () => {
        if (!supabase || !eventId) return;
        const { data } = await supabase
            .from('drinks')
            .select('*')
            .eq('event_id', eventId);

        if (data) setDrinks(data);
    };

    const handleAdd = async () => {
        if (!supabase || !eventId) return;
        // Simple prompt for now, could be a modal
        const name = prompt("Drink Name:");
        if (!name) return;
        const quantity = parseInt(prompt("Quantity:", "10") || "0");

        const { error } = await supabase
            .from('drinks')
            .insert([{ name, quantity, event_id: eventId }]);

        if (!error) fetchDrinks();
    };

    const handleDelete = async (id: string) => {
        if (!supabase) return;
        if (!confirm("Remove this item?")) return;

        const { error } = await supabase.from('drinks').delete().eq('id', id);
        if (!error) fetchDrinks();
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
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div>
                    <button
                        onClick={() => navigate('/events')}
                        className="flex items-center text-gray-400 hover:text-white mb-2 text-sm transition"
                    >
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Events
                    </button>
                    <h2 className="text-2xl font-bold">Inventory: {eventName}</h2>
                    <p className="text-gray-400">Manage available drinks for this event</p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={fetchDrinks} className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition">
                        <RefreshCw size={18} />
                        <span>Sync</span>
                    </button>
                    <button onClick={handleAdd} className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition shadow-lg shadow-purple-900/40">
                        <Plus size={18} />
                        <span>Add Item</span>
                    </button>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-800 text-gray-400">
                        <tr>
                            <th className="p-4 font-medium">Product Name</th>
                            <th className="p-4 font-medium text-center">Stock</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {drinks.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-gray-500">No drinks found for this event. Add some!</td>
                            </tr>
                        ) : (
                            drinks.map((drink) => (
                                <tr key={drink.id} className="hover:bg-gray-700/30 transition">
                                    <td className="p-4 font-medium">{drink.name}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${drink.quantity < 5 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {drink.quantity} UNITS
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDelete(drink.id)} className="p-2 text-gray-400 hover:text-red-400 transition hover:bg-red-900/20 rounded">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DrinksPage;
