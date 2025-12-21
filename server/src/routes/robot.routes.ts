import { Router } from 'express';
import { updateStatus, sendCommand, getCommand, startRobot, stopRobot, isRobotRunning } from '../controllers/robot.controller';

const router = Router();

router.post('/robot/status', updateStatus);
router.post('/robot/interact', sendCommand);
router.get('/robot/command', getCommand);
router.post('/robot/start', startRobot);
router.post('/robot/stop', stopRobot);
router.get('/robot/running', isRobotRunning);

export default router;
