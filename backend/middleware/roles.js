/**
 * Role-Based Access Control (RBAC) Middleware
 * Usage: authorize('admin') or authorize('admin', 'moderator')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}`,
        requiredRoles: allowedRoles,
        yourRole: userRole
      });
    }

    next();
  };
};

module.exports = { authorize };
