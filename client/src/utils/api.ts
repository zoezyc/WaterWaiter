// Utility to get the API base URL based on current hostname
// This ensures tablet/phone can connect to the backend via hotspot IP

export const getApiBaseUrl = (): string => {
    // If on localhost, use localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return '';  // Use relative URLs (Vite proxy handles it)
    }
    // On tablet/phone via hotspot, construct full URL
    return `http://${window.location.hostname}:3000`;
};

// Helper for making API calls
export const apiUrl = (path: string): string => {
    const base = getApiBaseUrl();
    return `${base}${path}`;
};

// Camera server URL
export const getCameraUrl = (): string => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:3001';
    }
    return `http://${window.location.hostname}:3001`;
};
