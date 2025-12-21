import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

export class SupabaseService {
    private static instance: SupabaseService;
    private client: SupabaseClient;

    private constructor() {
        this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    }

    public static getInstance(): SupabaseService {
        if (!SupabaseService.instance) {
            SupabaseService.instance = new SupabaseService();
        }
        return SupabaseService.instance;
    }

    public getClient(): SupabaseClient {
        return this.client;
    }
}

export const supabaseService = SupabaseService.getInstance();
