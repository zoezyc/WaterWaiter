import { Request, Response } from 'express';

/**
 * Get a single camera frame
 * GET /api/v1/camera/frame
 * 
 * Note: Camera streaming is handled by the Python camera server on port 3001.
 * Clients should fetch directly from http://localhost:3001/frame
 */
export const getCameraFrame = async (req: Request, res: Response): Promise<void> => {
    res.status(307).json({
        message: 'Camera streaming is handled by Python server',
        redirect: 'http://localhost:3001/frame'
    });
};

