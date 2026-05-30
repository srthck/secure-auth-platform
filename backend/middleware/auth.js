const { verifyAccessToken } = require('../utils/jwt');
const db = require('../config/db');

/**
 * Middleware: Authenticate JWT token from Authorization header
 * Attaches decoded user payload to req.user on success
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (logged out)
    const isBlacklisted = db.get('tokens')
      .find({ token })
      .value();

    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please log in again.'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Attach user info to request
    req.user = decoded;
    req.token = token;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.',
        expired: true
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

module.exports = { authenticate };
