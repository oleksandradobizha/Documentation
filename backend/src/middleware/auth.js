export function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    // In dev, if API_KEY is not set, allow requests (easier local iteration).
    return next();
  }
  const got = req.get("x-api-key");
  if (got !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
