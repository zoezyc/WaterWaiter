import http from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { socketService } from './services/socket.service';
import { startCameraServer, stopCameraServer } from './services/camera-process.service';

const server = http.createServer(app);

// WebSocket Setup - use socketService so controllers can emit events
socketService.initialize(server);

// Start Server
server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);

    // Start the Python camera server as a child process
    startCameraServer();
});

// Handle graceful shutdown
const shutdown = () => {
    logger.info('Shutting down server...');
    stopCameraServer();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);