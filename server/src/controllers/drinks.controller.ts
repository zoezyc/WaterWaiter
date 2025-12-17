import { Request, Response } from 'express';
import { supabaseService } from '../services/supabase.service';

export const getDrinks = async (req: Request, res: Response) => {
    const eventId = req.query.eventId as string;

    let query = supabaseService.getClient()
        .from('drinks')
        .select('*');

    if (eventId) {
        query = query.eq('event_id', eventId);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
};

export const addDrink = async (req: Request, res: Response) => {
    const { name, quantity, description, event_id } = req.body;
    const { data, error } = await supabaseService.getClient()
        .from('drinks')
        .insert([{ name, quantity, description, event_id }])
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
};

export const updateDrink = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabaseService.getClient()
        .from('drinks')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
};

export const deleteDrink = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { error } = await supabaseService.getClient()
        .from('drinks')
        .delete()
        .eq('id', id);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Drink deleted' });
};
