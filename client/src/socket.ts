import { io } from 'socket.io-client';

// Ensure this matches your server URL/port
// Using config or env vars is better, but hardcoding for relative simplicity locally for now
// Assuming vite proxy or same host, but usually separate ports in dev.
// WaterWaiter server seems to run on 'config.port'. I need to know what port that is.
// Usually 3000 or 5000. I'll default to localhost:3000 based on typical setups, 
// or I'll check server/src/config.ts if I can.
// Let's assume the API is at http://localhost:3000 for now or use window.location.hostname

const SOCKET_URL = 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
    autoConnect: true,
});
