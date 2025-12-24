import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, ChevronRight, Users, MapPin, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Event, DrinkList } from '../types/supabase';

const EventsPage: React.FC = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [drinkLists, setDrinkLists] = useState<DrinkList[]>([]);
    const [, setIsLoading] = useState(false);

    // Form state
    const [isCreating, setIsCreating] = useState(false);
    const [newEvent, setNewEvent] = useState({
        name: '',
        event_type: '',
        description: '',
        event_date: new Date().toISOString().split('T')[0],
        location: '',
        drink_list_id: ''
    });

    useEffect(() => {
        fetchEvents();
        fetchDrinkLists();
    }, []);

    const fetchEvents = async () => {
        if (!supabase) return;
        setIsLoading(true);
        const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching events:', error);
        if (data) setEvents(data);
        setIsLoading(false);
    };

    const fetchDrinkLists = async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('drink_list').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching drink lists:', error);
        if (data) setDrinkLists(data);
    };

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
        if (!newEvent.name) {
            alert('Event Name is required');
            return;
        }
        if (!newEvent.event_date) {
            alert('Event Date is required');
            return;
        }

        let targetListId = newEvent.drink_list_id;

        if (!targetListId) {
            const createNew = confirm("No Drink List selected. Create a new one?");
            if (createNew) {
                const newId = await createDefaultDrinkList();
                if (!newId) return;
                targetListId = newId;
            } else {
                return;
            }
        }

        const { error } = await supabase.from('events').insert([{
            name: newEvent.name,
            event_type: newEvent.event_type || 'General',
            description: newEvent.description,
            event_date: newEvent.event_date,
            location: newEvent.location,
            drink_list_id: targetListId,
            status: 'scheduled'
        }]);

        if (!error) {
            fetchEvents();
            setIsCreating(false);
            setNewEvent({
                name: '',
                event_type: '',
                description: '',
                event_date: new Date().toISOString().split('T')[0],
                location: '',
                drink_list_id: ''
            });
        } else {
            alert('Error creating event: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!supabase) return;
        if (!confirm('Are you sure? This will delete the event and its inventory.')) return;

        const { error } = await supabase.from('events').delete().eq('id', id);
        if (!error) fetchEvents();
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

            {isCreating && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-lg font-bold mb-4">New Event Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            placeholder="Event Name (e.g. Smith Wedding)"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.name}
                            onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                        />
                        <input
                            placeholder="Event Type (e.g. Wedding, Conference)"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.event_type}
                            onChange={e => setNewEvent({ ...newEvent, event_type: e.target.value })}
                        />
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <Calendar size={16} className="text-gray-500 mr-2" />
                            <input
                                type="date"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.event_date}
                                onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <MapPin size={16} className="text-gray-500 mr-2" />
                            <input
                                placeholder="Location"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.location}
                                onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2 md:col-span-2">
                            <List size={16} className="text-gray-500 mr-2" />
                            <select
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.drink_list_id}
                                onChange={e => setNewEvent({ ...newEvent, drink_list_id: e.target.value })}
                            >
                                <option value="">-- Select Drink Menu --</option>
                                {drinkLists.map(dl => (
                                    <option key={dl.id} value={dl.id}>{dl.name}</option>
                                ))}
                            </select>
                        </div>

                        <input
                            placeholder="Description"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white md:col-span-2"
                            value={newEvent.description}
                            onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                        <button onClick={handleCreate} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white">Save Event</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                    <div key={event.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-500/50 transition group">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                    {event.status?.toUpperCase() || 'SCHEDULED'}
                                </span>
                                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => handleDelete(event.id)} className="p-1 hover:text-red-400"><Trash2 size={16} /></button>
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
                                onClick={() => navigate(`/drinks?eventId=${event.id}&eventName=${encodeURIComponent(event.name)}`)}
                                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center space-x-2 text-sm font-medium transition"
                            >
                                <span>Manage Inventory</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventsPage;
