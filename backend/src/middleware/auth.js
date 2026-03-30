function auth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next();

  const provided = req.headers['x-admin-token'];
  if (provided !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = auth;
