import express from 'express';
import cors from 'cors';
import { config } from './config';

export const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

import apiRoutes from './routes/api.routes';
import robotRoutes from './routes/robot.routes';

app.use('/api/v1', apiRoutes);
app.use('/api/v1', robotRoutes);
