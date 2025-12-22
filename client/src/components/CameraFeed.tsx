import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react';

interface CameraFeedProps {
    refreshInterval?: number; // ms between frame refreshes
    className?: string;
}

const CameraFeed: React.FC<CameraFeedProps> = ({
    refreshInterval = 500, // Default 2 FPS
    className = ''
}) => {
    const [frame, setFrame] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchFrame = async () => {
        try {
            // Use Python camera server on port 3001
            const response = await fetch('http://127.0.0.1:3001/frame');

            if (!response.ok) {
                throw new Error('Camera not available');
            }

            const data = await response.json();

            if (data.frame) {
                setFrame(data.frame);
                setIsConnected(true);
                setError(null);
            } else {
                setError('No frame data received');
                setIsConnected(false);
            }
        } catch (err) {
            setError('Unable to connect to camera');
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchFrame();

        // Set up interval for continuous refresh
        intervalRef.current = setInterval(fetchFrame, refreshInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [refreshInterval]);

    const handleRefresh = () => {
        setIsLoading(true);
        fetchFrame();
    };

    return (
        <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${className}`}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Camera size={16} className="text-white" />
                    <span className="text-sm font-medium text-white">Robot Camera</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                    <span className="text-xs text-gray-300">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                    <button
                        onClick={handleRefresh}
                        className="p-1 hover:bg-white/10 rounded transition"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={`text-white ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Camera Feed */}
            <div className="aspect-video flex items-center justify-center">
                {isLoading && !frame ? (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <RefreshCw size={32} className="animate-spin" />
                        <span className="text-sm">Connecting to camera...</span>
                    </div>
                ) : error && !frame ? (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <AlertTriangle size={32} className="text-yellow-500" />
                        <span className="text-sm">{error}</span>
                        <button
                            onClick={handleRefresh}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
                        >
                            Retry
                        </button>
                    </div>
                ) : frame ? (
                    <img
                        src={frame}
                        alt="Robot Camera Feed"
                        className="w-full h-full object-cover"
                    />
                ) : null}
            </div>

            {/* Footer with stats */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>~{Math.round(1000 / refreshInterval)} FPS</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};

export default CameraFeed;
