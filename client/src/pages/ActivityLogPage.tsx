import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Download, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';

interface ActivityLog {
    id: string;
    robot_id: string;
    event_id: string | null;
    drink_id: string;
    user_id: string | null;
    action: string;  // 'take' or 'refill'
    quantity_changed: number;
    timestamp: string;
    note: string | null;
    robot_name?: string;
    event_name?: string;
    drink_name?: string;
    user_name?: string;  // From profiles table
}

const ActivityLogPage: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedEventId, setSelectedEventId] = useState(''); // Empty = all events
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [page, filterType, selectedEventId]);

    const handleDelete = async (logId: string) => {
        if (!supabase) return;
        if (!confirm('Delete this activity log entry?')) return;

        const { error } = await supabase
            .from('activity_log')
            .delete()
            .eq('id', logId);

        if (error) {
            alert('Failed to delete log: ' + error.message);
        } else {
            fetchLogs();
        }
    };

    const handleDeleteAll = async () => {
        if (!supabase) return;
        if (!confirm('Are you sure you want to delete ALL activity logs? This action cannot be undone!')) return;

        const { error } = await supabase
            .from('activity_log')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

        if (error) {
            alert('Failed to delete all logs: ' + error.message);
        } else {
            fetchLogs();
        }
    };

    const fetchEvents = async () => {
        if (!supabase) return;
        const { data, error } = await supabase
            .from('events')
            .select('id, name, event_date')
            .order('event_date', { ascending: false });

        if (error) {
            console.error('Error fetching events:', error);
        } else if (data) {
            setEvents(data);
        }
    };

    const fetchLogs = async () => {
        if (!supabase) return;
        setLoading(true);

        try {
            let query = supabase
                .from('activity_log')
                .select(`
                    *,
                    robots(robot_name),
                    events(name),
                    drinks(name),
                    profiles(role)
                `)
                .order('timestamp', { ascending: false })
                .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

            if (filterType !== 'all') {
                query = query.eq('action', filterType);
            }

            // Filter by event if selected
            if (selectedEventId) {
                query = query.eq('event_id', selectedEventId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching logs:', error);
            } else if (data) {
                const formatted = data.map((item: any) => ({
                    ...item,
                    robot_name: item.robots?.robot_name,
                    event_name: item.events?.name,
                    drink_name: item.drinks?.name,
                    user_name: item.profiles?.role
                }));
                setLogs(formatted);
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        searchTerm === '' ||
        log.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getActivityColor = (action: string) => {
        const colors: Record<string, string> = {
            take: 'bg-red-500/20 text-red-400',
            refill: 'bg-green-500/20 text-green-400'
        };
        return colors[action] || 'bg-gray-500/20 text-gray-400';
    };

    const exportToCSV = () => {
        const headers = ['Timestamp', 'Robot', 'Event', 'Drink', 'User', 'Action', 'Quantity', 'Note'];
        const rows = filteredLogs.map(log => [
            new Date(log.timestamp).toLocaleString(),
            log.robot_name || 'N/A',
            log.event_name || 'N/A',
            log.drink_name || 'N/A',
            log.user_name || 'Admin',
            log.action,
            log.quantity_changed,
            log.note || ''
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity_log_${new Date().toISOString()}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold flex items-center space-x-2">
                        <History size={28} />
                        <span>Activity Log</span>
                    </h2>
                    <div className="flex space-x-2">
                        <button onClick={exportToCSV} className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition">
                            <Download size={18} />
                            <span>Export CSV</span>
                        </button>
                        {logs.length > 0 && (
                            <button onClick={handleDeleteAll} className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition">
                                <Trash2 size={18} />
                                <span>Delete All</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex space-x-4">
                    <div className="flex-1 relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={selectedEventId}
                            onChange={e => setSelectedEventId(e.target.value)}
                            className="pl-10 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none appearance-none min-w-[200px]"
                        >
                            <option value="">All Events</option>
                            {events.map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.name} ({new Date(event.event_date).toLocaleDateString()})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="pl-10 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none appearance-none"
                        >
                            <option value="all">All Actions</option>
                            <option value="refill">Refill</option>
                            <option value="take">Take</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500">Loading activity logs...</div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center p-12 bg-gray-800 rounded-xl border border-gray-700">
                    <History size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">No activity logs found</p>
                </div>
            ) : (
                <>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-700/50 border-b border-gray-700">
                                <tr>
                                    <th className="p-4 text-left font-medium">Time</th>
                                    <th className="p-4 text-left font-medium">Robot</th>
                                    <th className="p-4 text-left font-medium">Event</th>
                                    <th className="p-4 text-left font-medium">Drink</th>
                                    <th className="p-4 text-left font-medium">User</th>
                                    <th className="p-4 text-center font-medium">Action</th>
                                    <th className="p-4 text-center font-medium">Quantity</th>
                                    <th className="p-4 text-left font-medium">Note</th>
                                    <th className="p-4 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-700/30 transition">
                                        <td className="p-4 text-sm text-gray-400">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="p-4 font-medium">{log.robot_name || 'Unknown'}</td>
                                        <td className="p-4 text-gray-400">{log.event_name || 'N/A'}</td>
                                        <td className="p-4 text-gray-400">{log.drink_name || 'N/A'}</td>
                                        <td className="p-4 text-gray-400">{log.user_name || 'Admin'}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getActivityColor(log.action)}`}>
                                                {log.action.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-sm">{log.quantity_changed}</td>
                                        <td className="p-4 text-sm text-gray-400">{log.note || '-'}</td>
                                        <td className="p-4">
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    className="p-2 text-red-400 hover:bg-red-900/20 rounded transition"
                                                    title="Delete Log"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Previous
                        </button>
                        <span className="text-gray-400">Page {page}</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={filteredLogs.length < ITEMS_PER_PAGE}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default ActivityLogPage;
