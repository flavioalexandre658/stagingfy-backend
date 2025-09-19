import { Router } from 'express';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

const router = Router();

// Handle all BetterAuth routes
router.use('/api/auth', async (req, res) => {
  try {
    // Convert Express request to Web API Request
    const url = new URL(req.url, `${req.protocol}://${req.get('host')}`);
    const requestInit: RequestInit = {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      requestInit.body = JSON.stringify(req.body);
    }
    
    const webRequest = new Request(url, requestInit);
    
    const response = await auth.handler(webRequest);
    
    // Set headers from the response
    if (response.headers) {
      for (const [key, value] of response.headers.entries()) {
        res.setHeader(key, value);
      }
    }

    // Set status and send body
    res.status(response.status || 200);
    
    if (response.body) {
      const body = await response.text();
      res.send(body);
    } else {
      res.end();
    }
  } catch (error) {
    logger.error('Auth handler error:', error as Error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        statusCode: 500,
      },
    });
  }
});

export default router;