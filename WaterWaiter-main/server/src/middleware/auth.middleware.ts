import { Request, Response, NextFunction } from 'express';
import { supabaseService } from '../services/supabase.service';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
    user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabaseService.getClient().auth.getUser(token);

        if (error || !user) {
            logger.warn(`Auth failed: ${error?.message}`);
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (err) {
        logger.error('Auth middleware error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
