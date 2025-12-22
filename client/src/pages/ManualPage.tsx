import React, { useEffect, useState, useRef } from 'react';
import { Joystick } from 'react-joystick-component';
import { StopCircle, Zap, AlertTriangle } from 'lucide-react';
import { useRobotStore } from '../store/robot.store';
import clsx from 'clsx';
import type { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick';

const ManualPage: React.FC = () => {
    const { isAutonomous } = useRobotStore();
    const [speed, setSpeed] = useState(50);
    const [lastCommand, setLastCommand] = useState<string>('STOP');
    const lastSentTime = useRef<number>(0);

    // Throttled command sender
    const sendCommand = async (linear: { x: number, y: number, z: number }, angular: { x: number, y: number, z: number }) => {
        const now = Date.now();
        // Throttle to 100ms, unless it's a STOP command (all zeros) which should pass immediately
        const isStop = linear.y === 0 && angular.z === 0;
        if (!isStop && now - lastSentTime.current < 100) return;

        lastSentTime.current = now;

        try {
            await fetch('/api/v1/robot/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ linear, angular })
            });
        } catch (error) {
            console.error("Failed to send manual command", error);
        }
    };

    const handleMove = (event: IJoystickUpdateEvent) => {
        const x = event.x || 0;
        const y = event.y || 0;
        setLastCommand(`Vector: ${x.toFixed(2)}, ${y.toFixed(2)}`);

        // Map Joystick (X: Left/Right, Y: Forward/Back) to Robot (Linear Y, Angular Z)
        // Normalize speed factor (0.0 to 1.0) based on slider
        const speedFactor = speed / 100;

        const linear = { x: 0, y: y * speedFactor, z: 0 };
        // Invert X for angular Z? Usually Left (negative X) -> Turn Left (positive Z).
        // Try -x first.
        const angular = { x: 0, y: 0, z: -x * speedFactor };

        sendCommand(linear, angular);
    };

    const handleJoystickStop = () => {
        setLastCommand('STOP');
        sendCommand({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    };

    // Emergency Stop / Full Stop
    const handleEmergencyStop = async () => {
        setLastCommand('EMERGENCY STOP');
        try {
            // Stops python script AND manual movement
            await fetch('/api/v1/robot/stop', { method: 'POST' });
        } catch (error) {
            console.error("Failed to trigger emergency stop", error);
        }
    };

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const speedFactor = speed / 100;
            // Constant velocity for keyboard press - simplistic implementation
            // Real keyboard driving usually requires keyup handling or interval loop
            // For now, we utilize the repeater:

            let linear = { x: 0, y: 0, z: 0 };
            let angular = { x: 0, y: 0, z: 0 };
            let cmdName = '';

            switch (e.key) {
                case 'ArrowUp':
                    linear.y = 1 * speedFactor; cmdName = 'FORWARD'; break;
                case 'ArrowDown':
                    linear.y = -1 * speedFactor; cmdName = 'BACKWARD'; break;
                case 'ArrowLeft':
                    angular.z = 1 * speedFactor; cmdName = 'LEFT'; break; // Positive Z = Left
                case 'ArrowRight':
                    angular.z = -1 * speedFactor; cmdName = 'RIGHT'; break; // Negative Z = Right
                case ' ':
                    handleEmergencyStop(); return;
                default: return; // Ignore other keys
            }

            setLastCommand(cmdName);
            sendCommand(linear, angular);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                handleJoystickStop();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [speed]); // Re-bind when speed changes

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

            {isAutonomous && (
                <div className="bg-orange-900/40 border border-orange-500/50 p-4 rounded-xl flex items-center text-orange-200 animate-pulse">
                    <AlertTriangle className="mr-3" />
                    <span className="font-bold">WARNING: Autonomous Mode is active. Manual controls may conflict! Stop robot first.</span>
                </div>
            )}

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
                            stop={handleJoystickStop}
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

            <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-red-900/40 transition-colors" onClick={handleEmergencyStop}>
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
