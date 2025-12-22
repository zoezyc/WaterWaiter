import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RobotState {
    isConnected: boolean;
    cpuTemp: number;
    isAutonomous: boolean;
    // Autonomous Context
    activeEventId: string | null;
    activeRobot: { id: string, robot_name: string } | null;
    interactionState: 'IDLE' | 'SEARCHING' | 'APPROACHING' | 'INTERACTING' | 'SELECTING_DRINK' | 'PROCESSING' | 'SERVING' | 'ERROR';
    // Sensor / Telemetry Data
    bboxHeight: number;
    detectionConfidence: number;
    personDetected: boolean;
    uptime: number; // seconds
    latency: number; // ms
    latencyHistory: number[];

    setConnected: (connected: boolean) => void;
    updateStatus: (temp: number) => void;
    setAutonomous: (active: boolean) => void;

    setActiveEventId: (id: string | null) => void;
    setActiveRobot: (robot: { id: string, robot_name: string } | null) => void;
    setInteractionState: (state: RobotState['interactionState']) => void;

    updateStatusFull: (data: Partial<RobotState>) => void;
    incrementUptime: () => void;
    addLatencySample: (ms: number) => void;
}

export const useRobotStore = create<RobotState>()(
    persist(
        (set) => ({
            isConnected: false,
            cpuTemp: 0,
            isAutonomous: false,
            activeEventId: null,
            activeRobot: null,
            interactionState: 'IDLE',
            bboxHeight: 0,
            detectionConfidence: 0,
            personDetected: false,
            uptime: 0,
            latency: 0,
            latencyHistory: [],

            setConnected: (connected) => set({ isConnected: connected }),
            updateStatus: (temp) => set({ cpuTemp: temp }),
            setAutonomous: (active) => set({ isAutonomous: active }),

            setActiveEventId: (id) => set({ activeEventId: id }),
            setActiveRobot: (robot) => set({ activeRobot: robot }),
            setInteractionState: (state) => set({ interactionState: state }),

            updateStatusFull: (data) => set((state) => ({ ...state, ...data })),
            incrementUptime: () => set((state) => ({ uptime: state.uptime + 1 })),
            addLatencySample: (ms) => set((state) => {
                const newHistory = [...state.latencyHistory, ms].slice(-20); // Keep last 20 samples
                return { latencyHistory: newHistory, latency: ms };
            }),
        }),
        {
            name: 'robot-storage',
            partialize: (state) => ({
                activeEventId: state.activeEventId,
                activeRobot: state.activeRobot
            }),
        }
    )
);
