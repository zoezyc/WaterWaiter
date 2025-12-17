import React, { useState } from 'react';
import { Play, Pause, User, Check, Coffee } from 'lucide-react';
import clsx from 'clsx';
import { useRobotStore } from '../store/robot.store';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase (mocking env vars for now - user should have filled them)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safely initialize or return null if missing (prevents white screen crash)
const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

type InteractionState = 'IDLE' | 'SEARCHING' | 'APPROACHING' | 'INTERACTING' | 'SELECTING_DRINK' | 'PROCESSING' | 'SERVING';

// Mock drinks list (ideally fetched from DB)
const DRINKS_OPTIONS = [
    { id: 1, name: 'Water', icon: '💧' },
    { id: 2, name: 'Cola', icon: '🥤' },
    { id: 3, name: 'Orange Soda', icon: '🍊' },
    { id: 4, name: 'Coffee', icon: '☕' },
];

const AutoPage: React.FC = () => {
    const { isAutonomous, setAutonomous } = useRobotStore();
    const [interactionState, setInteractionState] = useState<InteractionState>('IDLE');
    const [selectedAction, setSelectedAction] = useState<'TAKE' | 'ADD' | null>(null);
    const [, setSelectedDrink] = useState<any>(null);

    const toggleAuto = () => {
        const newState = !isAutonomous;
        setAutonomous(newState);
        if (newState) {
            setInteractionState('SEARCHING');
            // Simulate AI Flow
            setTimeout(() => setInteractionState('APPROACHING'), 2500);
            setTimeout(() => setInteractionState('INTERACTING'), 5000);
        } else {
            setInteractionState('IDLE');
        }
    };

    const handleInitialChoice = (action: 'TAKE' | 'ADD') => {
        setSelectedAction(action);
        setInteractionState('SELECTING_DRINK');
    };

    const handleDrinkSelection = async (drink: any) => {
        setSelectedDrink(drink);
        setInteractionState('PROCESSING');

        // Logic to send to Supabase
        try {
            if (supabase) {
                // In a real app: await supabase.from('logs').insert(...)
                console.log(`[SUPABASE] Sending: ${selectedAction} - ${drink.name}`);
            } else {
                console.warn('[SUPABASE] Client not initialized (check .env VITE_ vars)');
            }

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            setInteractionState('SERVING');
            // Reset after service
            setTimeout(() => {
                setInteractionState('SEARCHING'); // Loop back to finding next person
                setSelectedAction(null);
                setSelectedDrink(null);
            }, 3000);

        } catch (error) {
            console.error('Failed to log to Supabase:', error);
            setInteractionState('INTERACTING'); // Go back on error
        }
    };

    const handleEnd = () => {
        setInteractionState('SEARCHING');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Logic & Control Panel */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-full flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-6">Autonomous Brain</h2>

                        <div className="space-y-4">
                            <div className={clsx("p-4 rounded-lg border flex items-center justify-between", interactionState === 'SEARCHING' ? "bg-blue-900/30 border-blue-500" : "bg-gray-900 border-gray-800")}>
                                <span>1. Search</span>
                                {interactionState === 'SEARCHING' && <span className="animate-pulse text-blue-400">●</span>}
                            </div>
                            <div className={clsx("p-4 rounded-lg border flex items-center justify-between", interactionState === 'APPROACHING' ? "bg-yellow-900/30 border-yellow-500" : "bg-gray-900 border-gray-800")}>
                                <span>2. Approach</span>
                                {interactionState === 'APPROACHING' && <span className="animate-pulse text-yellow-400">●</span>}
                            </div>
                            <div className={clsx("p-4 rounded-lg border flex items-center justify-between", ['INTERACTING', 'SELECTING_DRINK', 'PROCESSING'].includes(interactionState) ? "bg-purple-900/30 border-purple-500" : "bg-gray-900 border-gray-800")}>
                                <span>3. Interact</span>
                                {['INTERACTING', 'SELECTING_DRINK', 'PROCESSING'].includes(interactionState) && <span className="animate-pulse text-purple-400">●</span>}
                            </div>
                            <div className={clsx("p-4 rounded-lg border flex items-center justify-between", interactionState === 'SERVING' ? "bg-green-900/30 border-green-500" : "bg-gray-900 border-gray-800")}>
                                <span>4. Serve/Task</span>
                                {interactionState === 'SERVING' && <span className="animate-pulse text-green-400">●</span>}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={toggleAuto}
                        className={clsx(
                            "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all mt-8",
                            isAutonomous
                                ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/40"
                                : "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/40"
                        )}
                    >
                        {isAutonomous ? <><Pause /> <span>STOP WAITER</span></> : <><Play /> <span>START WAITER</span></>}
                    </button>
                </div>
            </div>

            {/* Tablet Interface Preview */}
            <div className="lg:col-span-2 flex flex-col space-y-6">
                <div className="flex-1 bg-gray-900/50 rounded-xl border border-gray-700 p-8 relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute top-4 left-4 bg-gray-800 px-3 py-1 rounded-full text-xs text-gray-500 border border-gray-700">
                        ROBOT TABLET SCREEN
                    </div>

                    {/* Screens */}
                    {interactionState === 'IDLE' && (
                        <div className="text-gray-600">
                            <h3 className="text-2xl font-bold">Auto Mode Disabled</h3>
                            <p>Enable autonomous mode to start the waiter workflow.</p>
                        </div>
                    )}

                    {(interactionState === 'SEARCHING' || interactionState === 'APPROACHING') && (
                        <div className="text-blue-400">
                            <div className="w-24 h-24 rounded-full bg-blue-500/10 mx-auto flex items-center justify-center mb-6 animate-pulse">
                                <User size={48} />
                            </div>
                            <h3 className="text-3xl font-bold text-white">Looking for customers...</h3>
                        </div>
                    )}

                    {interactionState === 'INTERACTING' && (
                        <div className="space-y-8 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-4xl font-bold text-white mb-8">Hello! How can I help?</h2>
                            <div className="grid grid-cols-2 gap-6">
                                <button
                                    onClick={() => handleInitialChoice('TAKE')}
                                    className="p-8 bg-purple-600 hover:bg-purple-700 rounded-2xl transition flex flex-col items-center gap-4 hover:scale-105"
                                >
                                    <Coffee size={40} />
                                    <span className="font-bold text-xl">Take a Drink</span>
                                </button>
                                <button
                                    onClick={() => handleInitialChoice('ADD')}
                                    className="p-8 bg-blue-600 hover:bg-blue-700 rounded-2xl transition flex flex-col items-center gap-4 hover:scale-105"
                                >
                                    <Check size={40} />
                                    <span className="font-bold text-xl">Add Inventory</span>
                                </button>
                            </div>
                            <button onClick={handleEnd} className="text-gray-400 hover:text-white mt-4">No thanks, goodbye</button>
                        </div>
                    )}

                    {interactionState === 'SELECTING_DRINK' && (
                        <div className="space-y-6 w-full max-w-lg animate-in fade-in zoom-in duration-300">
                            <h2 className="text-3xl font-bold text-white">
                                {selectedAction === 'TAKE' ? "What would you like?" : "What are you adding?"}
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {DRINKS_OPTIONS.map(drink => (
                                    <button
                                        key={drink.id}
                                        onClick={() => handleDrinkSelection(drink)}
                                        className="p-6 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 border border-gray-700 rounded-xl transition flex items-center space-x-4 group"
                                    >
                                        <span className="text-2xl group-hover:scale-110 transition">{drink.icon}</span>
                                        <span className="font-semibold text-lg">{drink.name}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setInteractionState('INTERACTING')} className="text-sm text-gray-500 hover:text-white">Back</button>
                        </div>
                    )}

                    {interactionState === 'PROCESSING' && (
                        <div className="text-yellow-400 animate-pulse">
                            <p className="text-2xl font-bold">Processing request...</p>
                        </div>
                    )}

                    {interactionState === 'SERVING' && (
                        <div className="text-green-400">
                            <div className="w-24 h-24 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-6">
                                <Check size={48} />
                            </div>
                            <h3 className="text-3xl font-bold text-white">Done!</h3>
                            <p className="text-gray-400 mt-2">Inventory updated.</p>
                            <p className="text-sm text-gray-600 mt-8">Returning to patrol in 3s...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutoPage;
