import { Router } from 'express';
import * as robotController from '../controllers/robot.controller';
import * as drinksController from '../controllers/drinks.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Robot Routes (no auth for robot script to call)
router.post('/robot/start', robotController.startRobot);
router.post('/robot/stop', robotController.stopRobot);
router.get('/robot/running', robotController.isRobotRunning);
router.post('/robot/status', robotController.updateStatus);
router.get('/robot/command', robotController.getCommand);
router.post('/robot/interact', robotController.sendCommand);

// Legacy robot routes (with auth)
router.post('/robot/connect', authMiddleware, robotController.connectRobot);
router.get('/robot/status-legacy', authMiddleware, robotController.getRobotStatus);
router.post('/robot/control', authMiddleware, robotController.manualControl);

// Drinks Routes
router.get('/drinks', authMiddleware, drinksController.getDrinks);
router.post('/drinks', authMiddleware, drinksController.addDrink);
router.put('/drinks/:id', authMiddleware, drinksController.updateDrink);
router.delete('/drinks/:id', authMiddleware, drinksController.deleteDrink);

export default router;
