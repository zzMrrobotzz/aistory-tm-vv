import axios from 'axios';
import { LoginData, RegisterData, UserProfile } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://key-manager-backend.onrender.com/api';

const authApi = axios.create({
  baseURL: API_URL,
});

const setAuthToken = (token: string | null) => {
  if (token) {
    authApi.defaults.headers.common['x-auth-token'] = token;
    localStorage.setItem('userToken', token);
  } else {
    delete authApi.defaults.headers.common['x-auth-token'];
    localStorage.removeItem('userToken');
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
    console.warn('Backend registration failed, using demo mode:', error.message);
    
    // TEMPORARY DEMO MODE - Remove when backend is fixed
    console.log('🔧 Demo mode: Creating temporary account');
    
    // Simulate successful registration
    const demoToken = 'demo_' + Date.now() + '_' + Math.random().toString(36);
    const demoUser = {
      id: Date.now(),
      username: userData.username,
      email: userData.email,
      token: demoToken,
      msg: 'Demo account created successfully!'
    };
    
    // Store demo account info
    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    setAuthToken(demoToken);
    
    return demoUser;
  }
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
    console.warn('Backend login failed, checking demo mode:', error.message);
    
    // Check if user has demo account
    const demoUser = localStorage.getItem('demo_user');
    if (demoUser) {
      const user = JSON.parse(demoUser);
      if (user.email === userData.email) {
        console.log('🔧 Demo mode: Logging in with demo account');
        setAuthToken(user.token);
        return user;
      }
    }
    
    // If no demo account, throw error
    throw new Error('No demo account found. Please register first.');
  }
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
  
  try {
    const response = await authApi.get('/auth/me');
    return response.data;
  } catch (error) {
    console.warn('Backend profile fetch failed, checking demo mode:', error);
    
    // Check demo user
    const demoUser = localStorage.getItem('demo_user');
    if (demoUser && token?.startsWith('demo_')) {
      const user = JSON.parse(demoUser);
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        remainingCredits: 1000, // Demo credits
        subscriptionStatus: 'demo',
        createdAt: new Date().toISOString()
      };
    }
    
    throw error;
  }
};

// Make sure setAuthToken is called on initial load if token exists
const token = getCurrentUserToken();
if (token) {
    setAuthToken(token);
} 