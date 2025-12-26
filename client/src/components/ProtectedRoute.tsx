import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: ('admin' | 'staff' | 'client')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, role, loading } = useAuth();
    const navigate = useNavigate();

    // Show loading spinner while checking auth
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

    // Logged in but role not fetched yet
    if (!role) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading profile...</p>
                </div>
            </div>
        );
    }

    // Wrong role - show access denied
    if (!allowedRoles.includes(role)) {
        const handleGoToDashboard = () => {
            // Redirect to appropriate dashboard based on actual role
            if (role === 'admin') navigate('/admin');
            else if (role === 'staff') navigate('/staff');
            else if (role === 'client') navigate('/client');
            else navigate('/login');
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
                <div className="max-w-md w-full bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="text-gray-400 mb-6">
                        You don't have permission to access this page.
                    </p>
                    <p className="text-sm text-gray-500">
                        Your role: <span className="font-mono text-red-400">{role}</span>
                    </p>
                    <button
                        onClick={handleGoToDashboard}
                        className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Authorized - render children
    return <>{children}</>;
}
