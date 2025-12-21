import { Request, Response } from 'express';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// In-memory state
let currentStatus: string = 'idle';
let nextCommand: string | null = null;
let robotProcess: ChildProcess | null = null;

/**
 * Start the robot Python script
 * POST /api/v1/robot/start
 */
export const startRobot = async (req: Request, res: Response): Promise<void> => {
    try {
        if (robotProcess) {
            res.status(400).json({ error: 'Robot is already running' });
            return;
        }

        // Path from WaterWaiter/server to WaterWaiter/robot
        const robotScriptPath = path.join(process.cwd(), '..', 'robot', 'tipsy.py');
        const robotDir = path.join(process.cwd(), '..', 'robot');
        logger.info(`Starting robot script: ${robotScriptPath}`);
        logger.info(`Robot working directory: ${robotDir}`);

        // Use the venv Python which has aiohttp installed
        const pythonPath = path.join(process.cwd(), '..', '..', '.venv', 'Scripts', 'python.exe');
        logger.info(`Using Python: ${pythonPath}`);

        robotProcess = spawn(pythonPath, [robotScriptPath], {
            cwd: robotDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        robotProcess.on('error', (error) => {
            logger.error(`[Robot Spawn Error]: ${error.message}`);
            robotProcess = null;
            currentStatus = 'idle';
            socketService.emit('robot_status', { status: 'idle' });
        });

        robotProcess.stdout?.on('data', (data) => {
            logger.info(`[Robot]: ${data.toString().trim()}`);
        });

        robotProcess.stderr?.on('data', (data) => {
            logger.error(`[Robot Error]: ${data.toString().trim()}`);
        });

        robotProcess.on('close', (code) => {
            logger.info(`Robot process exited with code ${code}`);
            robotProcess = null;
            currentStatus = 'idle';
            socketService.emit('robot_status', { status: 'idle' });
        });

        currentStatus = 'starting';
        socketService.emit('robot_status', { status: 'starting' });

        res.json({ success: true, message: 'Robot started' });
    } catch (error) {
        logger.error('Error starting robot:', error);
        res.status(500).json({ error: 'Failed to start robot' });
    }
};

/**
 * Stop the robot Python script
 * POST /api/v1/robot/stop
 */
export const stopRobot = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!robotProcess) {
            res.status(400).json({ error: 'Robot is not running' });
            return;
        }

        robotProcess.kill('SIGTERM');
        robotProcess = null;
        currentStatus = 'idle';
        socketService.emit('robot_status', { status: 'idle' });

        logger.info('Robot stopped');
        res.json({ success: true, message: 'Robot stopped' });
    } catch (error) {
        logger.error('Error stopping robot:', error);
        res.status(500).json({ error: 'Failed to stop robot' });
    }
};

/**
 * Robot posts its status updates here.
 * POST /api/v1/robot/status
 */
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.body;
        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }

        currentStatus = status;
        logger.info(`Robot status update: ${status}`);

        // Broadcast to frontend
        socketService.emit('robot_status', { status });

        res.json({ success: true, status });
    } catch (error) {
        logger.error('Error updating robot status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Frontend sends commands to the robot here.
 * POST /api/v1/robot/interact
 */
export const sendCommand = async (req: Request, res: Response): Promise<void> => {
    try {
        const { command } = req.body;
        if (!command) {
            res.status(400).json({ error: 'Command is required' });
            return;
        }

        nextCommand = command;
        logger.info(`Command received for robot: ${command}`);

        res.json({ success: true, command });
    } catch (error) {
        logger.error('Error sending command:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Robot polls this endpoint to get next command.
 * GET /api/v1/robot/command
 */
export const getCommand = async (req: Request, res: Response): Promise<void> => {
    try {
        const command = nextCommand;

        if (command) {
            nextCommand = null; // Consumption
        }

        res.json({ command: command || 'none' });
    } catch (error) {
        logger.error('Error getting command:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Check if robot is running
 * GET /api/v1/robot/running
 */
export const isRobotRunning = async (req: Request, res: Response): Promise<void> => {
    res.json({ running: robotProcess !== null, status: currentStatus });
};

// --- Legacy / Existing Methods Support ---

export const connectRobot = async (req: Request, res: Response): Promise<void> => {
    logger.info('Connect robot called');
    res.json({ success: true, message: 'Robot connected (stub)' });
};

export const getRobotStatus = async (req: Request, res: Response): Promise<void> => {
    res.json({ status: currentStatus, success: true });
};

export const manualControl = async (req: Request, res: Response): Promise<void> => {
    logger.info('Manual control called', req.body);
    res.json({ success: true, message: 'Manual control signal received' });
};
