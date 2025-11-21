import { Router } from 'express';
import { auth } from '@/lib/auth';
import { signJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';

const router = Router();

router.use('/', async (req, res) => {
  try {
    const url = new URL(
      req.originalUrl,
      `${req.protocol}://${req.get('host')}`
    );

    // Copiar headers corretamente
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const requestInit: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      requestInit.body = JSON.stringify(req.body);
    }

    const webRequest = new Request(url, requestInit);
    const response = await auth.handler(webRequest);

    // Headers da resposta
    response.headers.forEach((value: string, key: any) => {
      res.setHeader(key, value);
    });

    const bodyText = await response.text();
    const isSignIn = req.path.includes('sign-in');
    if (isSignIn && response.status >= 200 && response.status < 300) {
      try {
        const json = bodyText ? JSON.parse(bodyText) : {};
        const user = json?.user ?? json?.data?.user ?? null;
        const session = json?.session ?? json?.data?.session ?? null;
        if (user?.id && user?.email) {
          const jwtToken = signJwt({
            sub: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            sessionId: session?.id,
          });
          res.setHeader('Authorization', `Bearer ${jwtToken}`);
          const merged = { ...json, token: jwtToken, tokenType: 'jwt' };
          res.status(response.status || 200).json(merged);
          return;
        }
      } catch {}
    }
    res.status(response.status || 200).send(bodyText || undefined);
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
