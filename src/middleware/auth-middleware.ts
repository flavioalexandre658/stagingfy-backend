import { Request, Response, NextFunction } from 'express';
import { auth } from '@/lib/auth';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string | undefined;
    image?: string | undefined;
  };
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication token required',
          statusCode: 401,
        },
      });
      return;
    }

    const jwtPayload = verifyJwt<any>(token);
    if (jwtPayload && jwtPayload.sub && jwtPayload.email) {
      req.user = {
        id: jwtPayload.sub,
        email: jwtPayload.email,
        name: jwtPayload.name,
        image: jwtPayload.image,
      };
      next();
      return;
    }

    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
      }
    });
    const session = await auth.api.getSession({ headers });

    if (!session?.session || !session?.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          statusCode: 401,
        },
      });
      return;
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || undefined,
      image: session.user.image || undefined,
    };

    req.session = {
      id: session.session.id,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt,
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error as Error);
    res.status(401).json({
      success: false,
      error: {
        message: 'Authentication failed',
        statusCode: 401,
      },
    });
    return;
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const jwtPayload = verifyJwt<any>(token);
      if (jwtPayload && jwtPayload.sub && jwtPayload.email) {
        req.user = {
          id: jwtPayload.sub,
          email: jwtPayload.email,
          name: jwtPayload.name,
          image: jwtPayload.image,
        };
      } else {
        const session = await auth.api.getSession({
          headers: new Headers(req.headers as Record<string, string>),
        });

        if (session?.session && session?.user) {
          req.user = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name || undefined,
            image: session.user.image || undefined,
          };

          req.session = {
            id: session.session.id,
            userId: session.session.userId,
            expiresAt: session.session.expiresAt,
          };
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error as Error);
    next();
  }
};