const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export const API_BASE_URL = `${BACKEND_URL}/api`;

export const API_ENDPOINTS = {
  // Auth
  register: `${API_BASE_URL}/auth/register`,
  login: `${API_BASE_URL}/auth/login`,
  
  // Users
  getUser: (id: string) => `${API_BASE_URL}/users/${id}`,
  updateUser: (id: string) => `${API_BASE_URL}/users/${id}`,
  changePassword: (id: string) => `${API_BASE_URL}/users/${id}/change-password`,
  
  // Runs
  createRun: `${API_BASE_URL}/runs`,
  getAllRuns: `${API_BASE_URL}/runs`,
  getUserRuns: (userId: string) => `${API_BASE_URL}/runs/user/${userId}`,
  
  // Leaderboard
  leaderboard: `${API_BASE_URL}/leaderboard`,
  
  // Admin
  verifyAdmin: `${API_BASE_URL}/admin/verify`,
  adminUsers: `${API_BASE_URL}/admin/users`,
};
