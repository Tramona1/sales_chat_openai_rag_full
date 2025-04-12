/**
 * Simple test API endpoint
 */
export default function handler(req, res) {
  res.status(200).json({ 
    success: true, 
    message: 'API test endpoint is working',
    method: req.method,
    query: req.query,
    time: new Date().toISOString()
  });
} 