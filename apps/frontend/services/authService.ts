import axios from 'axios';
import { LoginData, RegisterData, UserProfile } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://key-manager-backend.onrender.com/api';

const authApi = axios.create({
  baseURL: API_URL,
});

const setAuthToken = (token: string | null) => {
  if (token) {
    authApi.defaults.headers.common['x-auth-token'] = token;
    localStorage.setItem('token', token);
  } else {
    delete authApi.defaults.headers.common['x-auth-token'];
    localStorage.removeItem('token');
  }
};

export const register = async (userData: RegisterData) => {
  // Try with fetch first to bypass CORS
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ msg: 'Registration failed' }));
      throw new Error(errorData.msg || 'Registration failed');
    }
    
    const data = await response.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  } catch (error) {
    // Fallback to original axios method
    console.warn('Fetch failed, trying axios:', error.message);
  }
  
  // Original axios method
  const response = await authApi.post('/auth/register', userData);
  if (response.data.token) {
    setAuthToken(response.data.token);
  }
  return response.data;
};

export const login = async (userData: LoginData) => {
  // Try with fetch first to bypass CORS
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ msg: 'Login failed' }));
      throw new Error(errorData.msg || 'Login failed');
    }
    
    const data = await response.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  } catch (error) {
    console.warn('Fetch failed, trying axios:', error.message);
  }
  
  // Fallback to axios
  const response = await authApi.post('/auth/login', userData);
  if (response.data.token) {
    setAuthToken(response.data.token);
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('userToken');
  setAuthToken(null);
};

export const getCurrentUserToken = () => {
  return localStorage.getItem('userToken');
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const token = getCurrentUserToken();
  if (token) {
    setAuthToken(token);
  }
  const response = await authApi.get('/auth/me');
  return response.data;
};

// Make sure setAuthToken is called on initial load if token exists
const token = getCurrentUserToken();
if (token) {
    setAuthToken(token);
} 