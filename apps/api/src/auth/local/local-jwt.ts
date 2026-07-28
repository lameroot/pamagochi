import jwt from 'jsonwebtoken';

export const LOCAL_JWT_ISSUER = 'pamagochi-local';
export const LOCAL_JWT_AUDIENCE = 'pamagochi-api';
export const LOCAL_JWT_TTL_SECONDS = 15 * 60; // short-lived, per spec

export interface LocalJwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface SignLocalJwtInput {
  subject: string;
  email: string;
  roles: string[];
  secret: string;
}

export function signLocalJwt(input: SignLocalJwtInput): string {
  return jwt.sign({ email: input.email, roles: input.roles }, input.secret, {
    subject: input.subject,
    issuer: LOCAL_JWT_ISSUER,
    audience: LOCAL_JWT_AUDIENCE,
    expiresIn: LOCAL_JWT_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyLocalJwt(token: string, secret: string): LocalJwtPayload {
  const decoded = jwt.verify(token, secret, {
    issuer: LOCAL_JWT_ISSUER,
    audience: LOCAL_JWT_AUDIENCE,
    algorithms: ['HS256'],
  });

  if (typeof decoded === 'string') {
    throw new Error('Unexpected local JWT payload shape');
  }

  return decoded as LocalJwtPayload;
}
