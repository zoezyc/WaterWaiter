import { Request, Response } from 'express';
import { viamService } from '../services/viam.service';
import { logger } from '../utils/logger';

export const connectRobot = async (req: Request, res: Response) => {
    try {
        await viamService.connect();
        res.json({ message: 'Connected to robot' });
    } catch (error: any) {
        logger.error('Error connecting to robot', error);
        res.status(500).json({ error: error.message || 'Failed to connect' });
    }
};

export const getRobotStatus = (req: Request, res: Response) => {
    const client = viamService.getClient();
    res.json({
        connected: !!client,
        // TODO: specific component statuses 
    });
};

// Placeholder for manual control - usually better over WebSocket
export const manualControl = async (req: Request, res: Response) => {
    const { command, value } = req.body;
    // Implement manual control logic here using viamService
    res.json({ message: `Command ${command} executed` });
};
