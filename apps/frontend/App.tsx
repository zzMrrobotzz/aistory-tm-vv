import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainApp from './MainApp';
import Login from './components/pages/Login';
import Register from './components/pages/Register';
import Pricing from './components/pages/Pricing';
import ProtectedRoute from './components/ProtectedRoute';
import { getCurrentUserToken } from './services/authService';

const App: React.FC = () => {
  const [userToken, setUserToken] = React.useState(getCurrentUserToken);
  
  // Update token state when localStorage changes
  React.useEffect(() => {
    const handleStorageChange = () => {
      setUserToken(getCurrentUserToken());
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check for direct localStorage modifications
    const interval = setInterval(() => {
      const currentToken = getCurrentUserToken();
      if (currentToken !== userToken) {
        setUserToken(currentToken);
      }
    }, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [userToken]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={userToken ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={userToken ? <Navigate to="/" /> : <Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;