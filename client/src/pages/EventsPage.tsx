import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { createClient } from '@supabase/supabase-js';

// Supabase setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

interface Event {
    id: string;
    name: string;
    date: string;
    status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
    description: string;
}

const EventsPage: React.FC = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [, setIsLoading] = useState(false);

    // Form state
    const [isCreating, setIsCreating] = useState(false);
    const [newEvent, setNewEvent] = useState({ name: '', date: '', description: '', status: 'UPCOMING' });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        if (!supabase) return;
        setIsLoading(true);
        const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
        if (data) setEvents(data as any);
        setIsLoading(false);
    };

    const handleCreate = async () => {
        if (!supabase) return;
        const { error } = await supabase.from('events').insert([newEvent]);
        if (!error) {
            fetchEvents();
            setIsCreating(false);
            setNewEvent({ name: '', date: '', description: '', status: 'UPCOMING' });
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

    const StatusBadge = ({ status }: { status: string }) => {
        const colors = {
            'UPCOMING': 'bg-blue-500/20 text-blue-400',
            'ACTIVE': 'bg-green-500/20 text-green-400',
            'COMPLETED': 'bg-gray-500/20 text-gray-400'
        };
        return (
            <span className={clsx("px-2 py-1 rounded text-xs font-bold", colors[status as keyof typeof colors])}>
                {status}
            </span>
        );
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
                            placeholder="Event Name"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.name}
                            onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                        />
                        <input
                            type="datetime-local"
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            value={newEvent.date}
                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                        />
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
                                <StatusBadge status={event.status} />
                                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => handleDelete(event.id)} className="p-1 hover:text-red-400"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2">{event.name}</h3>
                            <div className="flex items-center text-gray-400 text-sm mb-4">
                                <Calendar size={14} className="mr-2" />
                                {new Date(event.date).toLocaleDateString()}
                            </div>
                            <p className="text-gray-500 text-sm line-clamp-2 mb-6">{event.description}</p>

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
