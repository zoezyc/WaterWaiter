import React from 'react';
import { Cpu, Wifi, Activity } from 'lucide-react';
import { useRobotStore } from '../store/robot.store';

const MetricCard = ({ icon: Icon, label, value, color, unit }: any) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
            <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-2xl font-bold">{value}<span className="text-sm text-gray-500 ml-1">{unit}</span></p>
        </div>
    </div>
);

const RobotPage: React.FC = () => {
    const { cpuTemp, isConnected, latency, latencyHistory, uptime, alerts } = useRobotStore();

    // Format uptime
    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold">System Status</h2>
                <p className="text-gray-400 mt-1">Real-time health monitoring and diagnostics</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={Cpu}
                    label="CPU Temp"
                    value={cpuTemp}
                    unit="°C"
                    color="bg-red-500"
                />
                <MetricCard
                    icon={Wifi}
                    label="Network Latency"
                    value={latency}
                    unit="ms"
                    color="bg-blue-500"
                />
                <MetricCard
                    icon={Activity}
                    label="Uptime"
                    value={formatUptime(uptime)}
                    unit=""
                    color="bg-purple-500"
                />
            </div>

            {/* Diagnostics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                        <Wifi size={20} className="mr-2 text-blue-500" />
                        Connectivity
                    </h3>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-400">Connection to Backend: <span className="text-green-400 font-mono">Connected</span></p>
                        <p className="text-sm text-gray-400">Robot Status: <span className={isConnected ? "text-green-400 font-mono" : "text-red-400 font-mono"}>{isConnected ? "Online" : "Offline"}</span></p>

                        <div className="h-32 bg-gray-900 rounded mt-4 flex items-end justify-center pb-2 px-2 space-x-1">
                            {/* Latency Graph */}
                            {latencyHistory && latencyHistory.length > 0 ? (
                                latencyHistory.map((val, i) => {
                                    // Normalize: 0ms -> 0%, 200ms -> 100%
                                    const h = Math.min(100, Math.max(5, (val / 200) * 100));
                                    return (
                                        <div key={i} style={{ height: `${h}%` }} className="w-4 bg-blue-500/50 rounded-t-sm" title={`${val}ms`} />
                                    );
                                })
                            ) : (
                                <p className="text-xs text-gray-500 self-center">No Data</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Alerts */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-96 flex flex-col">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                        <Activity size={20} className="mr-2 text-yellow-500" />
                        Recent Alerts
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {alerts && alerts.length > 0 ? (
                            alerts.map((alert, i) => (
                                <div key={i} className="flex flex-col bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 text-sm">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${alert.type === 'error' ? 'bg-red-500/20 text-red-400' :
                                                alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {alert.type}
                                        </span>
                                        <span className="text-gray-500 text-xs">{alert.timestamp}</span>
                                    </div>
                                    <p className="text-gray-300">{alert.message}</p>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <Activity size={32} className="mb-2 opacity-50" />
                                <p>No recent alerts logged</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RobotPage;
