const jwt = require('jsonwebtoken');

// Middleware xác thực admin
const isAdmin = (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const token = authHeader.substring(7); // Bỏ 'Bearer ' prefix
    
    // Verify token (thay YOUR_ADMIN_SECRET bằng secret thực tế)
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'your_admin_secret');
    
    // Kiểm tra role admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Middleware xác thực user (cho các route AI proxy)
const authenticateUser = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid Authorization header:', authHeader);
      return res.status(401).json({ 
        success: false, 
        message: 'User token required' 
      });
    }

    const token = authHeader.substring(7);
    console.log('🔑 Received token (first 50 chars):', token.substring(0, 50) + '...');
    console.log('🔧 Using JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'USING FALLBACK');
    
    // Verify user token (sử dụng cùng secret với auth route)
    const jwtSecret = process.env.JWT_SECRET || 'your_user_secret';
    console.log('🔐 Attempting JWT verify with secret length:', jwtSecret.length);
    const decoded = jwt.verify(token, jwtSecret);
    
    // Log để debug
    console.log('✅ Token decoded successfully:', JSON.stringify(decoded, null, 2));
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('User auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired user token' 
    });
  }
};

module.exports = { isAdmin, authenticateUser }; 