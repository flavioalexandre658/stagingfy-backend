import { Router } from 'express';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

const router = Router();

router.all('*', async (req, res) => {
  try {
    const url = new URL(
      req.originalUrl,
      `${req.protocol}://${req.get('host')}`
    );

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
      else if (value !== undefined) headers.set(key, value);
    }

    const requestInit: RequestInit = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      requestInit.body = JSON.stringify(req.body);
    }

    const webRequest = new Request(url, requestInit);
    const response = await auth.handler(webRequest);

    response.headers.forEach((value, key) => res.setHeader(key, value));

    const body = await response.text();
    res.status(response.status || 200).send(body || undefined);
  } catch (error) {
    logger.error('Auth handler error:', error as Error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', statusCode: 500 },
    });
  }
});

export default router;
