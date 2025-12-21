import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { config } from '../config';
import { logger } from '../utils/logger';

class SocketService {
    private static instance: SocketService;
    private io: Server | null = null;

    private constructor() {}

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public initialize(server: HttpServer): void {
        this.io = new Server(server, {
            cors: {
                origin: config.corsOrigin,
                methods: ['GET', 'POST'],
            },
        });

        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });

        logger.info('Socket.io initialized');
    }

    public getIO(): Server {
        if (!this.io) {
            throw new Error('Socket.io not initialized!');
        }
        return this.io;
    }

    public emit(event: string, data: any): void {
        this.getIO().emit(event, data);
    }
}

export const socketService = SocketService.getInstance();
