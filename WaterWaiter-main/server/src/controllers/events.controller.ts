import { Request, Response } from 'express';
import { supabaseService } from '../services/supabase.service';

export const getEvents = async (req: Request, res: Response) => {
    const { data, error } = await supabaseService.getClient()
        .from('events')
        .select('*')
        .order('date', { ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
};

export const createEvent = async (req: Request, res: Response) => {
    const { name, date, status, description } = req.body;
    const { data, error } = await supabaseService.getClient()
        .from('events')
        .insert([{ name, date, status, description }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
};

export const updateEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabaseService.getClient()
        .from('events')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
};

export const deleteEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { error } = await supabaseService.getClient()
        .from('events')
        .delete()
        .eq('id', id);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Event deleted' });
};
