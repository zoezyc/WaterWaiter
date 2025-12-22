import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger';

let cameraProcess: ChildProcess | null = null;

/**
 * Start the Python camera server as a child process
 */
export function startCameraServer(): void {
    const robotDir = path.resolve(__dirname, '../../../robot');
    const cameraScript = path.join(robotDir, 'camera_server.py');

    logger.info('Starting Python camera server...');

    // Determine python command based on OS
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    cameraProcess = spawn(pythonCmd, [cameraScript], {
        cwd: robotDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    cameraProcess.stdout?.on('data', (data) => {
        logger.info(`[Camera] ${data.toString().trim()}`);
    });

    cameraProcess.stderr?.on('data', (data) => {
        logger.warn(`[Camera] ${data.toString().trim()}`);
    });

    cameraProcess.on('error', (error) => {
        logger.error('Failed to start camera server:', error);
    });

    cameraProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
            logger.warn(`Camera server exited with code ${code}`);
        }
        cameraProcess = null;
    });
}

/**
 * Stop the Python camera server
 */
export function stopCameraServer(): void {
    if (cameraProcess) {
        logger.info('Stopping Python camera server...');
        cameraProcess.kill('SIGTERM');
        cameraProcess = null;
    }
}

/**
 * Check if camera server is running
 */
export function isCameraServerRunning(): boolean {
    return cameraProcess !== null && !cameraProcess.killed;
}
