import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bot, Gamepad2, LayoutDashboard, Coffee, AlertCircle, LogOut, Calendar, ChevronDown, Package, History, BarChart3 } from 'lucide-react';
import { useRobotStore } from '../store/robot.store';
import clsx from 'clsx';

import { supabase } from '../services/supabase';
import type { Session } from '@supabase/supabase-js';

import { socket } from '../socket';

// Map robot status to UI interaction state
const statusToState: Record<string, 'IDLE' | 'SEARCHING' | 'APPROACHING' | 'INTERACTING' | 'SERVING'> = {
    'idle': 'IDLE',
    'searching': 'SEARCHING',
    'scanning': 'SEARCHING',
    'moving': 'APPROACHING',
    'serving': 'INTERACTING',
    'offering': 'INTERACTING',
    'returning': 'SERVING',
    'error': 'IDLE'
};

const Layout: React.FC = () => {
    const {
        isConnected,
        setConnected,
        setAutonomous,
        setInteractionState,
        updateStatusFull,
        incrementUptime,
        addLatencySample,
        selectedRobotId,
        setSelectedRobotId
    } = useRobotStore();

    const [session, setSession] = React.useState<Session | null>(null);
    const [robots, setRobots] = React.useState<{ id: string; robot_name: string; status: string | null }[]>([]);

    React.useEffect(() => {
        // Initial Fetch to sync state
        const fetchRunning = async () => {
            try {
                const res = await fetch('/api/v1/robot/running');
                if (res.ok) {
                    const data = await res.json();
                    setAutonomous(data.running);
                }
            } catch (e) {
                console.error("Failed to sync initial robot state", e);
            }
        };
        fetchRunning();

        // Fetch robots for selector
        const fetchRobots = async () => {
            if (!supabase) return;
            const { data, error } = await supabase
                .from('robots')
                .select('id, robot_name, status')
                .order('robot_name');
            if (error) {
                console.error('Error fetching robots:', error);
            } else if (data && data.length > 0) {
                setRobots(data);
                // Initialize selected robot if not set
                if (!selectedRobotId) {
                    setSelectedRobotId(data[0].id);
                }
            }
        };
        fetchRobots();

        // Socket Listeners
        // Socket Listeners
        const onConnect = () => {
            console.log("Socket Connected");
            setConnected(true);
        };

        const onDisconnect = () => {
            console.log("Socket Disconnected");
            setConnected(false);
        };

        const onRobotStatus = (data: any) => {
            // Update sensor data
            updateStatusFull({
                cpuTemp: data.cpuTemp || 55,
                bboxHeight: data.bboxHeight || 0,
                detectionConfidence: data.detectionConfidence || 0,
                personDetected: data.personDetected || false,
                // latency is updated by heartbeat now
            });

            // Update Interaction State
            const status = data.status;
            if (status) {
                const newState = statusToState[status] || 'IDLE';

                // Prevent overwriting active interaction states with 'SERVING'/'INTERACTING' from heartbeat
                const protectedStates = ['SELECTING_DRINK', 'PROCESSING', 'SERVING'];

                // ERROR FIX: Zustand setters don't support functional updates by default unless implemented manually.
                // We must read the current state directly.
                const currentState = useRobotStore.getState().interactionState;

                // If we are deep in interaction, and incoming is just generic "serving" (interacting), ignore it
                // Note: 'serving' now maps to 'SERVING', so this condition ensures we don't reset to INTERACTING if robot mistakenly sends 'offering'
                // or if we are in PROCESSING.
                if (protectedStates.includes(currentState) && newState === 'INTERACTING') {
                    // Keep current state
                    return;
                }

                // Allow transition
                setInteractionState(newState);
                setAutonomous(status !== 'idle');
            }
        };

        const onConnectError = (err: any) => {
            console.error("Socket Connection Error:", err);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('robot_status', onRobotStatus);
        socket.on('connect_error', onConnectError);

        // Uptime Timer
        const uptimeTimer = setInterval(() => {
            if (isConnected) incrementUptime();
        }, 1000);

        // Latency Heartbeat (Ping Backend)
        const pingTimer = setInterval(async () => {
            const start = Date.now();
            try {
                const res = await fetch('/api/v1/robot/running');
                if (res.ok) {
                    const end = Date.now();
                    const latency = end - start;
                    addLatencySample(latency);

                    const data = await res.json();
                    // Sync autonomous state periodically just in case socket missed it
                    setAutonomous(data.running);
                }
            } catch (e) {
                // console.error("Ping failed", e);
            }
        }, 2000);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('robot_status', onRobotStatus);
            socket.off('connect_error', onConnectError);
            clearInterval(uptimeTimer);
            clearInterval(pingTimer);
        };
    }, [isConnected]);

    React.useEffect(() => {
        if (!supabase) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleEmergencyStop = async () => {
        try {
            await fetch('/api/v1/robot/stop', { method: 'POST' });
            setAutonomous(false);
            setInteractionState('IDLE');
        } catch (error) {
            console.error('Emergency stop failed:', error);
            alert('Failed to send emergency stop command');
        }
    };

    const navItems = [
        { to: '/admin', label: 'Robot', icon: Bot },
        { to: '/admin/manual', label: 'Manual', icon: Gamepad2 },
        { to: '/admin/autonomous', label: 'Autonomous', icon: Activity },
        { to: '/admin/monitoring', label: 'Monitoring', icon: LayoutDashboard },
        { to: '/admin/events', label: 'Events', icon: Calendar },
        { to: '/admin/drinks', label: 'Drinks', icon: Coffee },
        { to: '/admin/inventory', label: 'Inventory', icon: Package },
        { to: '/admin/activity', label: 'Activity', icon: History },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ];

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Water Waiter
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/admin'} // Only exact match for /admin
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                                    isActive
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                )
                            }
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-700 space-y-4">
                    {/* Auth Status */}
                    {session ? (
                        <div className="space-y-2">
                            <div className="px-2 text-xs text-gray-500 truncate">
                                {session.user.email}
                            </div>
                            <button
                                onClick={async () => {
                                    await supabase?.auth.signOut();
                                    setSession(null);
                                    window.location.href = '/login';
                                }}
                                className="flex items-center space-x-3 text-gray-400 hover:text-red-400 transition-colors w-full px-2"
                            >
                                <LogOut size={20} />
                                <span className="font-medium">Log Out</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="flex items-center space-x-3 text-gray-400 hover:text-blue-400 transition-colors w-full px-2"
                        >
                            <LogOut size={20} className="rotate-180" />
                            <span className="font-medium">Log In</span>
                        </button>
                    )}

                    {/* Connection Status Footer */}
                    <div className="flex items-center space-x-2 px-2">
                        <div className={clsx("w-3 h-3 rounded-full", isConnected ? "bg-green-500" : "bg-red-500 animate-pulse")} />
                        <span className="text-sm font-medium text-gray-400">{isConnected ? "Online" : "Offline"}</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-lg font-semibold">Dashboard</h2>

                        {/* Robot Selector */}
                        {robots.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedRobotId || ''}
                                    onChange={(e) => setSelectedRobotId(e.target.value)}
                                    className="appearance-none bg-purple-900/30 border border-purple-500/50 rounded-lg px-4 py-2 pr-10 text-sm text-white hover:bg-purple-900/50 focus:outline-none focus:border-purple-400 transition cursor-pointer"
                                    title="Select robot context"
                                >
                                    {robots.map(robot => (
                                        <option key={robot.id} value={robot.id} className="bg-gray-900">
                                            🤖 {robot.robot_name} {robot.status ? `(${robot.status})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleEmergencyStop}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold flex items-center space-x-2 shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all">
                        <AlertCircle size={20} />
                        <span>EMERGENCY STOP</span>
                    </button>
                </header>

                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main >
        </div >
    );
};

export default Layout;
