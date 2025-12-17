import { create } from 'zustand';

interface RobotState {
    isConnected: boolean;
    cpuTemp: number;
    isAutonomous: boolean;
    setConnected: (connected: boolean) => void;
    updateStatus: (temp: number) => void;
    setAutonomous: (active: boolean) => void;
}

export const useRobotStore = create<RobotState>((set) => ({
    isConnected: false,
    cpuTemp: 0,
    isAutonomous: false,
    setConnected: (connected) => set({ isConnected: connected }),
    updateStatus: (temp) => set({ cpuTemp: temp }),
    setAutonomous: (active) => set({ isAutonomous: active }),
}));
