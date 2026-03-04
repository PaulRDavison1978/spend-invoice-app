export default function errorHandler(err, req, res, _next) {
  console.error(err.stack || err);

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
