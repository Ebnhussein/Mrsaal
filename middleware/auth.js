// middleware/auth.js
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول أولاً' });
}

module.exports = { requireAuth };
