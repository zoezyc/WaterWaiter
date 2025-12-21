import http from 'http';
import { Server } from 'socket.io';
import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';

const server = http.createServer(app);

// WebSocket Setup
const io = new Server(server, {
    cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Start Server
server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

// Handle graceful shutdown
const shutdown = () => {
    logger.info('Shutting down server...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
