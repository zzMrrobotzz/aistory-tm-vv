import React from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUserToken } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const userToken = getCurrentUserToken();
  
  console.log('ProtectedRoute check:', { 
    hasToken: !!userToken, 
    tokenPreview: userToken?.substring(0, 20) + '...' 
  });

  if (!userToken) {
    // User not authenticated, redirect to login page
    console.log('No token found, redirecting to login');
    return <Navigate to="/login" />;
  }

  console.log('Token found, allowing access to app');
  return children;
};

export default ProtectedRoute; 