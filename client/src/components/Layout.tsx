import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bot, Gamepad2, LayoutDashboard, Coffee, AlertCircle, LogOut, Calendar } from 'lucide-react';
import { useRobotStore } from '../store/robot.store';
import clsx from 'clsx';

const Layout: React.FC = () => {
    const { isConnected } = useRobotStore();

    const navItems = [
        { to: '/', label: 'Robot', icon: Bot },
        { to: '/manual', label: 'Manual', icon: Gamepad2 },
        { to: '/autonomous', label: 'Autonomous', icon: Activity },
        { to: '/monitoring', label: 'Monitoring', icon: LayoutDashboard },
        { to: '/events', label: 'Events', icon: Calendar },
        { to: '/drinks', label: 'Drinks', icon: Coffee },
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
                    {/* Log Out Button */}
                    <button
                        onClick={() => {
                            // Placeholder for logout logic
                            alert("Logging out...");
                            window.location.href = '/login';
                        }}
                        className="flex items-center space-x-3 text-gray-400 hover:text-red-400 transition-colors w-full px-2"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Log Out</span>
                    </button>

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
                    <h2 className="text-lg font-semibold">Dashboard</h2>

                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold flex items-center space-x-2 shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all">
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
