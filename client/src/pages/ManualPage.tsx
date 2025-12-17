import React, { useEffect, useState } from 'react';
import { Joystick } from 'react-joystick-component';
import { StopCircle, Zap } from 'lucide-react';
import { useRobotStore } from '../store/robot.store';
import clsx from 'clsx';

const ManualPage: React.FC = () => {
    const { } = useRobotStore();
    const [speed, setSpeed] = useState(50);
    const [lastCommand, setLastCommand] = useState<string>('STOP');

    const handleMove = (event: any) => {
        setLastCommand(`Vector: ${event.x?.toFixed(2)}, ${event.y?.toFixed(2)}`);
        // TODO: Emit socket event
    };

    const handleStop = () => {
        setLastCommand('STOP');
        // TODO: Emit socket stop
    };

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowUp': setLastCommand('FORWARD'); break;
                case 'ArrowDown': setLastCommand('BACKWARD'); break;
                case 'ArrowLeft': setLastCommand('LEFT'); break;
                case 'ArrowRight': setLastCommand('RIGHT'); break;
                case ' ': handleStop(); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div>
                    <h2 className="text-2xl font-bold flex items-center">
                        <Zap className="mr-2 text-yellow-500" />
                        Manual Control
                    </h2>
                    <p className="text-gray-400">Teleoperation via Joystick or Arrow Keys</p>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-400">Speed Limit</span>
                    <input
                        type="range"
                        min="0" max="100"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-32 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="font-mono bg-black/30 px-2 py-1 rounded w-12 text-center">{speed}%</span>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-items-center bg-gray-900/50 rounded-xl border border-gray-700/50 p-8">
                {/* Virtual Joystick Zone */}
                <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-gray-400 font-medium mb-4">Virtual Joystick</h3>
                    <div className="p-8 bg-gray-800 rounded-full shadow-2xl border border-gray-700">
                        <Joystick
                            size={150}
                            sticky={false}
                            baseColor="#1f2937"
                            stickColor="#9333ea"
                            move={handleMove}
                            stop={handleStop}
                        />
                    </div>
                </div>

                {/* Keyboard Visualizer */}
                <div className="flex flex-col items-center space-y-6">
                    <h3 className="text-gray-400 font-medium mb-4">Keyboard Input</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <div />
                        <div className={clsx("w-16 h-16 rounded-lg border-b-4 flex items-center justify-center font-bold text-xl transition-all", lastCommand === 'FORWARD' ? "bg-blue-600 border-blue-800 scale-95" : "bg-gray-700 border-gray-900")}>↑</div>
                        <div />
                        <div className={clsx("w-16 h-16 rounded-lg border-b-4 flex items-center justify-center font-bold text-xl transition-all", lastCommand === 'LEFT' ? "bg-blue-600 border-blue-800 scale-95" : "bg-gray-700 border-gray-900")}>←</div>
                        <div className={clsx("w-16 h-16 rounded-lg border-b-4 flex items-center justify-center font-bold text-xl transition-all", lastCommand === 'BACKWARD' ? "bg-blue-600 border-blue-800 scale-95" : "bg-gray-700 border-gray-900")}>↓</div>
                        <div className={clsx("w-16 h-16 rounded-lg border-b-4 flex items-center justify-center font-bold text-xl transition-all", lastCommand === 'RIGHT' ? "bg-blue-600 border-blue-800 scale-95" : "bg-gray-700 border-gray-900")}>→</div>
                    </div>

                    <div className="mt-8 text-center bg-black/40 p-4 rounded-lg font-mono text-green-400 w-64">
                        CMD: {lastCommand}
                    </div>
                </div>
            </div>

            <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center text-red-400">
                    <StopCircle className="mr-2" size={24} />
                    <span className="font-bold">SAFETY OVERRIDE</span>
                </div>
                <p className="text-sm text-gray-400">Press SPACEBAR for immediate emergency stop</p>
            </div>
        </div>
    );
};

export default ManualPage;
