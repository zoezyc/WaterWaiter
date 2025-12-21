import React from 'react';
import { Camera, AlertTriangle, Cpu, Activity, Wifi, Map } from 'lucide-react';
import { useRobotStore } from '../store/robot.store';
import clsx from 'clsx';

const MonitorPage: React.FC = () => {
    const { cpuTemp, isConnected } = useRobotStore();

    return (
        <div className="space-y-6">
            {/* Top Row: System Health */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center space-x-4">
                    <div className="p-3 bg-red-500/20 rounded-lg text-red-400">
                        <Cpu size={24} />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">CPU Temperature</p>
                        <p className="text-xl font-bold">{cpuTemp}°C</p>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center space-x-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">System Uptime</p>
                        <p className="text-xl font-bold">12h 30m</p>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                        <Wifi size={24} />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Connection Status</p>
                        <p className={clsx("text-xl font-bold", isConnected ? "text-green-400" : "text-red-400")}>
                            {isConnected ? "Connected" : "Disconnected"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Camera Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 relative aspect-video">
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <Camera size={48} className="mx-auto mb-2 opacity-50" />
                                <p>Waiting for Camera Stream...</p>
                            </div>
                        </div>
                        <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-xs text-green-400 font-mono">
                            LIVE FEED • 30 FPS
                        </div>
                        <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded text-xs text-blue-400 font-mono">
                            PERSON DETECTED (98%)
                        </div>
                    </div>

                    {/* Path Trace Placeholder */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 h-64 relative overflow-hidden">
                        <h3 className="font-semibold mb-3 flex items-center text-gray-400">
                            <Map size={18} className="mr-2" />
                            Motion Path Trace
                        </h3>
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                            <svg width="100%" height="100%" viewBox="0 0 400 200">
                                <path d="M 50 150 Q 200 150 200 100 T 350 50" stroke="cyan" strokeWidth="4" fill="none" strokeDasharray="5,5" />
                                <circle cx="350" cy="50" r="8" fill="cyan" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Sensor & Feedback */}
                <div className="space-y-6">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="font-semibold mb-3">Live Sensor Data</h3>
                        <div className="space-y-4">
                            <div className="bg-gray-700/40 p-3 rounded flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Ultrasonic (Front)</span>
                                <span className="text-xl font-mono text-cyan-400">120 cm</span>
                            </div>
                            <div className="bg-gray-700/40 p-3 rounded flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Ultrasonic (Rear)</span>
                                <span className="text-xl font-mono text-cyan-400">85 cm</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex-1">
                        <h3 className="font-semibold mb-3 flex items-center text-purple-400">
                            <AlertTriangle size={18} className="mr-2" />
                            Recent Alerts
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="p-2 border-l-2 border-green-500 bg-green-500/10 text-gray-300">
                                System stabilized.
                                <span className="block text-xs text-gray-500 mt-1">10:45 AM</span>
                            </div>
                            <div className="p-2 border-l-2 border-yellow-500 bg-yellow-500/10 text-gray-300">
                                Object avoidance triggered.
                                <span className="block text-xs text-gray-500 mt-1">10:42 AM</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitorPage;
