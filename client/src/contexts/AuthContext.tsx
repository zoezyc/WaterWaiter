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
                // Add 3 second timeout for session check
                const sessionTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Session timeout')), 3000)
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
        if (!supabase) {
            console.warn('[AuthContext] Supabase not initialized');
            setLoading(false);
            return;
        }

        try {
            console.log('[AuthContext] Fetching profile for user:', userId);

            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
            );

            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) {
                console.error('[AuthContext] Error fetching profile:', error);

                // If profile doesn't exist, create a default or require user to logout
                if (error.code === 'PGRST116') {
                    console.warn('[AuthContext] Profile not found in database. User needs a profile created.');
                    alert('Your account does not have a profile. Please contact the administrator.');
                    await signOut();
                }

                setLoading(false);
                return;
            }

            if (data) {
                console.log('[AuthContext] Profile loaded, role:', data.role);
                setProfile(data);
                setRole(data.role);
            } else {
                console.warn('[AuthContext] No profile data found for user');
                alert('Your account does not have a role assigned. Please contact the administrator.');
                await signOut();
            }
            setLoading(false);
        } catch (error: any) {
            console.error('[AuthContext] Exception in fetchProfile:', error);
            console.error('[AuthContext] Error details:', {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint
            });
            if (error.message === 'Profile fetch timeout') {
                alert('Unable to load your profile. Please try again or contact support.');
            }
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
