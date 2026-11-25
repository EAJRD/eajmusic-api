// Express 5 computes req.query on every access; deleting from that temporary
// object has no effect. Install one parsed, sanitized value for this request.
export function sanitizeQuery(req, res, next) {
  const query = Object.fromEntries(Object.entries(req.query).filter(([, value]) => value !== 'undefined' && value !== 'null'));
  Object.defineProperty(req, 'query', { value: query, configurable: true, enumerable: true });
  next();
}
