import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || 'your-secret-key';

export function signJwt(payload: Record<string, any>, options?: SignOptions) {
  const signOptions: SignOptions = {};
  signOptions.expiresIn = options?.expiresIn ?? '7d';
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

export function verifyJwt<T = JwtPayload>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch {
    return null;
  }
}