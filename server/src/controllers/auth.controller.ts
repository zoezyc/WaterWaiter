import { Request, Response } from 'express';
import { supabaseService } from '../services/supabase.service';
import { logger } from '../utils/logger';

// GET /api/v1/auth/profile/:userId
export async function getProfile(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
    }

    try {
        logger.info(`[Auth] Fetching profile for user: ${userId}`);
        const supabase = supabaseService.getClient();

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            logger.error(`[Auth] Profile fetch error:`, error);
            res.status(404).json({ error: 'Profile not found', details: error.message });
            return;
        }

        logger.info(`[Auth] Profile found for user: ${userId}, role: ${data.role}`);
        res.json(data);
    } catch (error: any) {
        logger.error(`[Auth] Exception fetching profile:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
