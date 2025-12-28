import { Request, Response } from 'express';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { startCameraServer, isCameraServerRunning } from '../services/camera-process.service';

// In-memory state
let currentStatus: string = 'idle';
let nextCommand: string | null = null;
let robotProcess: ChildProcess | null = null;
let manualProcess: ChildProcess | null = null; // Python script for manual control

/**
 * Start the robot Python script (Autonomous)
 * POST /api/v1/robot/start
 */
export const startRobot = async (req: Request, res: Response): Promise<void> => {
    try {
        // Stop manual process if running to avoid conflict
        if (manualProcess && !manualProcess.killed && manualProcess.exitCode === null) {
            logger.info('Stopping manual process before starting autonomous...');
            manualProcess.kill();
            manualProcess = null;
        } else {
            // Clear stale reference
            manualProcess = null;
        }

        // Check if robot process exists and is actually running
        if (robotProcess && !robotProcess.killed && robotProcess.exitCode === null) {
            res.status(400).json({ error: 'Robot is already running' });
            return;
        }

        // Reset stale process reference
        robotProcess = null;

        // Path from WaterWaiter/server to WaterWaiter/robot
        const robotScriptPath = path.join(process.cwd(), '..', 'robot', 'tipsy.py');
        const robotDir = path.join(process.cwd(), '..', 'robot');
        logger.info(`Starting robot script: ${robotScriptPath}`);
        logger.info(`Robot working directory: ${robotDir}`);

        // Use the venv Python to ensure dependencies like aiohttp/viam are found
        const pythonPath = process.platform === 'win32'
            ? path.resolve(__dirname, '../../../.venv/Scripts/python.exe')
            : path.resolve(__dirname, '../../../.venv/bin/python3');
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

            // Force kill any lingering python processes (Windows specific, aggressive but necessary for zombies)
            if (process.platform === 'win32') {
                spawn('taskkill', ['/F', '/IM', 'python.exe']);
            }

            // Restart camera server
            setTimeout(() => {
                if (!isCameraServerRunning()) {
                    startCameraServer();
                }
            }, 2000);
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
 * Stop the robot Python script (Autonomous and Manual)
 * POST /api/v1/robot/stop
 */
export const stopRobot = async (req: Request, res: Response): Promise<void> => {
    try {
        let stoppedSomething = false;

        if (robotProcess && !robotProcess.killed) {
            logger.info('Stopping autonomous robot process...');
            robotProcess.kill('SIGTERM');
            robotProcess = null;
            stoppedSomething = true;
        }

        if (manualProcess && !manualProcess.killed) {
            logger.info('Stopping manual drive process...');
            manualProcess.kill('SIGTERM');
            manualProcess = null;
            stoppedSomething = true;
        }

        // Force cleanup even if no processes found
        if (!stoppedSomething) {
            logger.warn('No active processes found, forcing cleanup...');
            robotProcess = null;
            manualProcess = null;

            // Zombie cleanup: Force kill and restart camera specifically
            if (process.platform === 'win32') {
                spawn('taskkill', ['/F', '/IM', 'python.exe']);
            }

            setTimeout(() => {
                if (!isCameraServerRunning()) {
                    startCameraServer();
                }
            }, 2000);
        }

        currentStatus = 'idle';
        socketService.emit('robot_status', { status: 'idle' });

        logger.info('Robot stopped successfully');
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
        const payload = req.body;
        const { status } = payload;

        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }

        currentStatus = status;
        logger.info(`Robot status update: ${status}`, { payload });

        // Broadcast to frontend (send everything including sensor data)
        socketService.emit('robot_status', payload);

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
    try {
        // Expect { linear: {x,y,z}, angular: {x,y,z} }
        const { linear, angular } = req.body;

        // Ensure Autonomous script is not running?
        // Ideally yes. But for now we just warn.
        if (robotProcess) {
            logger.warn('Manual control command received while Autonomous Mode is ACTIVE.');
        }

        // Spawn manual drive script if not running
        if (!manualProcess || manualProcess.killed) {
            const manualScriptPath = path.join(process.cwd(), '..', 'robot', 'manual_drive.py');
            const robotDir = path.join(process.cwd(), '..', 'robot');
            const pythonPath = process.platform === 'win32'
                ? path.resolve(__dirname, '../../../.venv/Scripts/python.exe')
                : path.resolve(__dirname, '../../../.venv/bin/python3');

            logger.info(`Spawning manual drive: ${manualScriptPath}`);
            manualProcess = spawn(pythonPath, [manualScriptPath], {
                cwd: robotDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            manualProcess.stderr?.on('data', (data) => logger.error(`[Manual Drive Error]: ${data}`));
            manualProcess.stdout?.on('data', (data) => logger.info(`[Manual Drive]: ${data}`));

            manualProcess.on('close', (code) => {
                logger.info(`Manual drive process exited with code ${code}`);
                manualProcess = null;
            });
        }

        // Send command via stdin
        if (manualProcess && manualProcess.stdin) {
            const cmdString = JSON.stringify({ linear, angular }) + '\n';
            manualProcess.stdin.write(cmdString);
        }

        res.json({ success: true });
    } catch (e) {
        logger.error('Manual control error', e);
        res.status(500).json({ error: 'Detailed control failed' });
    }
};
