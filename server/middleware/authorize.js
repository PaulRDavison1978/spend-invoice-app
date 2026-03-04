/**
 * Permission-checking middleware factory.
 * Usage: authorize('invoices.view_all')
 * Usage: authorize('invoices.view_all', 'invoices.view_own') — user needs at least one
 */
export default function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPerms = req.userPermissions || [];
    const hasPermission = requiredPermissions.some(p => userPerms.includes(p));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
