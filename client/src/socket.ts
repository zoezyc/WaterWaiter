import { io } from 'socket.io-client';

// Auto-detect socket URL based on hostname (enables tablet via hotspot)
const getSocketUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    return `http://${window.location.hostname}:3000`;
};

const SOCKET_URL = getSocketUrl();

export const socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
});

