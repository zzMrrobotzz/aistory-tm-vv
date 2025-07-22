import React from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUserToken } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const userToken = getCurrentUserToken();

  if (!userToken) {
    // User not authenticated, redirect to login page
    return <Navigate to="/login" />;
  }

  return children;
};

export default ProtectedRoute; 