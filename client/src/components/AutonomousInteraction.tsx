import { useEffect, useState } from 'react';
import { socket } from '../socket';
import axios from 'axios';
import { Bot, CheckCircle, XCircle } from 'lucide-react';

export default function AutonomousInteraction() {
    const [isVisible, setIsVisible] = useState(false);
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        const handleStatus = (data: { status: string }) => {
            console.log('Robot Status Received:', data);
            setStatus(data.status);
            if (data.status === 'waiting') {
                setIsVisible(true);
            } else {
                // Optional: Auto-hide if robot moves away or does something else
                setIsVisible(false);
            }
        };

        socket.on('robot_status', handleStatus);

        return () => {
            socket.off('robot_status', handleStatus);
        };
    }, []);

    const handleProceed = async () => {
        try {
            await axios.post('http://localhost:3000/api/v1/robot/interact', {
                command: 'proceed',
            });
            setIsVisible(false);
            setStatus('proceeding');
        } catch (err) {
            console.error('Error sending proceed command', err);
        }
    };

    const handleDismiss = () => {
        // Just hide the UI, maybe the robot times out on its own or we send a dismiss command?
        // For now, just hide UI.
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#1a1a1a] border border-gray-800 shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                        <Bot className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Robot Arrived</h2>
                    <p className="text-blue-100">Tipsy is waiting for your input</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="mb-6 rounded-xl bg-gray-900/50 p-4 text-center border border-gray-800">
                        <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Current Status</p>
                        <p className="text-white font-mono text-lg flex items-center justify-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            {status.toUpperCase()}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleDismiss}
                            className="flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-transparent py-4 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                        >
                            <XCircle size={20} />
                            Dismiss
                        </button>
                        <button
                            onClick={handleProceed}
                            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-4 font-bold text-white shadow-lg transition-transform hover:scale-105 hover:shadow-blue-500/25 active:scale-95"
                        >
                            <CheckCircle size={20} />
                            Proceed
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
