import axios from 'axios';
import { LoginData, RegisterData, UserProfile } from '../types';
import { deviceFingerprinter } from '../utils/deviceFingerprint.js';
import { sessionService } from './sessionService';

const API_URL = import.meta.env.VITE_API_URL || 'https://aistory-backend.onrender.com/api';

const authApi = axios.create({
  baseURL: API_URL,
});

// Add response interceptor to handle session termination
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.sessionTerminated) {
      // Session terminated due to concurrent login
      console.log('🔒 Session terminated:', error.response.data.reason);
      
      // Clear local auth data
      localStorage.removeItem('userToken');
      delete authApi.defaults.headers.common['x-auth-token'];
      
      // Redirect to login with message
      alert(error.response.data.reason || 'Your session has been terminated due to login from another device');
      window.location.replace('/login');
      
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

const setAuthToken = (token: string | null) => {
  if (token) {
    authApi.defaults.headers.common['x-auth-token'] = token;
    localStorage.setItem('userToken', token);
  } else {
    delete authApi.defaults.headers.common['x-auth-token'];
    localStorage.removeItem('userToken');
  }
};

// Helper function to get device fingerprint
const getDeviceFingerprint = async () => {
  try {
    const fingerprintData = await deviceFingerprinter.generateFingerprint();
    console.log('🔍 Device fingerprint generated:', fingerprintData.confidence + '% confidence');
    return fingerprintData;
  } catch (error) {
    console.warn('❌ Failed to generate device fingerprint:', error);
    return null;
  }
};

export const register = async (userData: RegisterData) => {
  try {
    console.log('Attempting registration with:', userData.username, userData.email);
    
    // Generate device fingerprint
    const fingerprintData = await getDeviceFingerprint();
    
    const requestBody = {
      ...userData,
      ...(fingerprintData && {
        fingerprint: fingerprintData.fingerprint,
        deviceInfo: fingerprintData.deviceInfo,
        sessionToken: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      })
    };
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('Registration response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ msg: 'Registration failed' }));
      console.error('Registration failed with error:', errorData);
      throw new Error(errorData.msg || 'Registration failed');
    }
    
    const data = await response.json();
    console.log('Registration successful, received data:', data);
    
    if (data.token) {
      setAuthToken(data.token);
      // Store session token for anti-sharing tracking
      if (data.sessionToken) {
        localStorage.setItem('sessionToken', data.sessionToken);
        // Set session token header for future requests
        authApi.defaults.headers.common['x-session-token'] = data.sessionToken;
      }
      // Remove any demo user data
      localStorage.removeItem('demo_user');
    }
    
    return {
      ...data,
      msg: 'Đăng ký thành công!'
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw error; // Don't fall back to demo mode, throw the actual error
  }
};

export const login = async (userData: LoginData) => {
  // Try with fetch first to bypass CORS
  try {
    console.log('Attempting login with:', userData.email);
    
    // Generate device fingerprint
    const fingerprintData = await getDeviceFingerprint();
    
    const requestBody = {
      ...userData,
      ...(fingerprintData && {
        fingerprint: fingerprintData.fingerprint,
        deviceInfo: fingerprintData.deviceInfo,
        sessionToken: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      })
    };
    
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ msg: 'Login failed' }));
      throw new Error(errorData.msg || 'Login failed');
    }
    
    const data = await response.json();
    if (data.token) {
      setAuthToken(data.token);
      // Store session token for anti-sharing tracking
      if (data.sessionToken) {
        localStorage.setItem('sessionToken', data.sessionToken);
        // Set session token header for future requests
        authApi.defaults.headers.common['x-session-token'] = data.sessionToken;
      }
    }
    
    console.log('Login successful, received data:', data);
    
    // Initialize session monitoring for single session mode
    if (data.sessionToken) {
      sessionService.initialize(() => {
        // Handle session termination
        console.log('🚪 Session terminated, redirecting to login...');
        logout();
        window.location.replace('/login');
      });
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
  // Cleanup session monitoring
  sessionService.cleanup();
  
  // Clear all auth-related data
  localStorage.removeItem('userToken');
  localStorage.removeItem('sessionToken');
  setAuthToken(null);
  // Remove session token header
  delete authApi.defaults.headers.common['x-session-token'];
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

export const refreshUserProfile = async (): Promise<UserProfile> => {
  console.log('🔄 Refreshing user profile...');
  const token = getCurrentUserToken();
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  setAuthToken(token);
  
  try {
    // Force fresh request with cache busting
    const response = await authApi.get(`/auth/me?t=${Date.now()}`);
    console.log('✅ User profile refreshed successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to refresh user profile:', error);
    throw error;
  }
};

// Make sure setAuthToken is called on initial load if token exists
const token = getCurrentUserToken();
const sessionToken = localStorage.getItem('sessionToken');
if (token) {
    setAuthToken(token);
    if (sessionToken) {
        authApi.defaults.headers.common['x-session-token'] = sessionToken;
        
        // Initialize session monitoring if we have a valid session
        sessionService.initialize(() => {
          console.log('🚪 Session terminated on app load, redirecting to login...');
          logout();
          window.location.replace('/login');
        });
    }
} 