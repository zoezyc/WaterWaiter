import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, ChevronRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Event } from '../types/supabase';

const EventsPage: React.FC = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [, setIsLoading] = useState(false);

    // Form state
    const [isCreating, setIsCreating] = useState(false);
    const [newEvent, setNewEvent] = useState({ event_type: '', description: '', event_size: 0 });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        if (!supabase) return;
        setIsLoading(true);
        const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (error) console.error('Error fetching events:', error);
        if (data) setEvents(data);
        setIsLoading(false);
    };

    const handleCreate = async () => {
        if (!supabase) return;
        if (!newEvent.event_type) {
            alert('Event Type is required');
            return;
        }

        const { error } = await supabase.from('events').insert([{
            event_type: newEvent.event_type,
            description: newEvent.description,
            event_size: newEvent.event_size || 0
        }]);

        if (!error) {
            fetchEvents();
            setIsCreating(false);
            setNewEvent({ event_type: '', description: '', event_size: 0 });
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
                    <p className="text-gray-400">Plan events and manage specific drink inventories</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition shadow-lg shadow-purple-900/40"
                >
                    <Plus size={18} />
                    <span>Create Event</span>
                </button>
            </div>

            {/* Create Modal logic simplified as a conditional render for demo */}
            {isCreating && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-in fade-in zoom-in duration-200">
                    <h3 className="text-lg font-bold mb-4">New Event Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            placeholder="Event Type (e.g. Wedding, Conference)"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.event_type}
                            onChange={e => setNewEvent({ ...newEvent, event_type: e.target.value })}
                        />
                        <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2">
                            <Users size={16} className="text-gray-500 mr-2" />
                            <input
                                type="number"
                                placeholder="Size"
                                className="bg-transparent p-2 text-white w-full outline-none"
                                value={newEvent.event_size}
                                onChange={e => setNewEvent({ ...newEvent, event_size: parseInt(e.target.value) || 0 })}
                            />
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
                                <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">
                                    {event.event_size} Guests
                                </span>
                                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => handleDelete(event.id)} className="p-1 hover:text-red-400"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2">{event.event_type}</h3>
                            <div className="flex items-center text-gray-400 text-sm mb-4">
                                <Calendar size={14} className="mr-2" />
                                {new Date(event.created_at).toLocaleDateString()}
                            </div>
                            <p className="text-gray-500 text-sm line-clamp-2 mb-6">{event.description || 'No description'}</p>

                            <button
                                onClick={() => navigate(`/drinks?eventId=${event.id}&eventName=${encodeURIComponent(event.event_type)}`)}
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
