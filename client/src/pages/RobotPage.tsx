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
    const { cpuTemp, isConnected } = useRobotStore();

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
                    label="Network Quality"
                    value="Latency"
                    unit="45ms"
                    color="bg-blue-500"
                />
                <MetricCard
                    icon={Activity}
                    label="Uptime"
                    value="--:--"
                    unit="Hrs"
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
                        <p className="text-sm text-gray-400">Connection to Viam: <span className={isConnected ? "text-green-400 font-mono" : "text-red-400 font-mono"}>{isConnected ? "Connected" : "Disconnected"}</span></p>

                        <div className="h-32 bg-gray-900 rounded mt-4 flex items-end justify-center pb-2 px-2 space-x-1">
                            {/* Fake Ping Graph */}
                            {[40, 60, 45, 80, 50, 60, 40, 30, 70, 50, 45, 60].map((h, i) => (
                                <div key={i} style={{ height: `${h}%` }} className="w-4 bg-blue-500/50 rounded-t-sm" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RobotPage;
