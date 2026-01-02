/* @refresh reset */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types/supabase';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    role: 'admin' | 'staff' | 'client' | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [role, setRole] = useState<'admin' | 'staff' | 'client' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session with timeout
        const initAuth = async () => {
            console.log('[AuthContext] Initializing auth...');
            if (!supabase) {
                console.warn('[AuthContext] Supabase not available');
                setLoading(false);
                return;
            }

            try {
                // Add 15 second timeout for session check
                const sessionTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Session timeout')), 15000)
                );

                const sessionPromise = supabase.auth.getSession();

                const result = await Promise.race([sessionPromise, sessionTimeout]) as any;
                const session = result?.data?.session;

                console.log('[AuthContext] Session check:', session ? 'User logged in' : 'No user');

                if (session?.user) {
                    setUser(session.user);
                    // Fetch profile without blocking
                    fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                    setRole(null);
                    setLoading(false);
                }
            } catch (error: any) {
                console.error('[AuthContext] Error initializing auth:', error);
                // On timeout or error, just set to not logged in
                setUser(null);
                setProfile(null);
                setRole(null);
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        if (!supabase) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[AuthContext] Auth state changed:', event);
                if (session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                    setRole(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            console.log('[AuthContext] Fetching profile for user:', userId);

            if (!supabase) {
                console.error('[AuthContext] Supabase client not available');
                setLoading(false);
                return;
            }

            // Fetch directly from Supabase (bypasses CORS issues on mobile/tablet)
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error || !data) {
                console.error('[AuthContext] Profile fetch error:', error);
                alert('Your account does not have a profile. Please contact the administrator.');
                await signOut();
                setLoading(false);
                return;
            }

            console.log('[AuthContext] Profile loaded, role:', data.role);
            setProfile(data);
            setRole(data.role);
            setLoading(false);
        } catch (error: any) {
            console.error('[AuthContext] Exception in fetchProfile:', error);
            alert('Error loading profile. Please try again.');
            setLoading(false);
        }
    };

    const signOut = async () => {
        if (!supabase) return;

        try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setRole(null);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, role, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
