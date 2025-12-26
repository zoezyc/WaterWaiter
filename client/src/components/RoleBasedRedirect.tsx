import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from 'lucide-react';

export default function RoleBasedRedirect() {
    const { user, role, loading } = useAuth();

    // Show loading while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Not logged in - redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Redirect based on role
    if (role === 'admin') {
        return <Navigate to="/admin" replace />;
    } else if (role === 'staff') {
        return <Navigate to="/staff" replace />;
    } else if (role === 'client') {
        return <Navigate to="/client" replace />;
    }

    // Role not recognized - redirect to login
    return <Navigate to="/login" replace />;
}
