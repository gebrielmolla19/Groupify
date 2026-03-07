/**
 * API Configuration
 * Central configuration for API endpoints and WebSocket connection
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api/v1';

// Derive socket URL by stripping the /api/v1 suffix so we connect to the root server
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace('/api/v1', '');

