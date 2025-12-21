import { createRobotClient, RobotClient, ViamClientOptions } from '@viamrobotics/sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

export class ViamService {
    private static instance: ViamService;
    private robotClient: RobotClient | null = null;
    private isConnected: boolean = false;

    private constructor() { }

    public static getInstance(): ViamService {
        if (!ViamService.instance) {
            ViamService.instance = new ViamService();
        }
        return ViamService.instance;
    }

    public async connect(): Promise<void> {
        if (this.isConnected) {
            logger.info('Viam already connected');
            return;
        }

        try {
            const opts: any = {
                credentials: {
                    type: 'api-key',
                    payload: config.viam.apiKey,
                    authEntity: config.viam.apiKeyId,
                },
                signalingAddress: config.viam.robotUrl,
            };
            this.robotClient = await createRobotClient(opts);
            this.isConnected = true;
            logger.info('Connected to Viam Robot');

            // Monitor connection
            // this.robotClient.on('disconnect', () => { ... }) // Check SDK for events if needed
        } catch (error) {
            logger.error('Failed to connect to Viam Robot:', error);
            throw error;
        }
    }

    public getClient(): RobotClient | null {
        return this.robotClient;
    }

    public async disconnect(): Promise<void> {
        if (this.robotClient) {
            // Note: sdk might not have explicit close/disconnect on the client interface depending on version
            // but typically we'd look for a way to clean up.
            // For now we just reset the local reference.
            this.isConnected = false;
            this.robotClient = null;
            logger.info('Disconnected from Viam');
        }
    }
}

export const viamService = ViamService.getInstance();
