import { Elysia } from 'elysia';
import { verifyToken } from '../utils/jwt';

export const authMiddleware = new Elysia()
  .derive({ as: 'global' }, async ({ request, cookie: { auth }, set }: any) => {
    const token = auth?.value || request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      return { user: null };
    }

    try {
      const decoded = verifyToken(token);
      return { user: decoded };
    } catch (error) {
      return { user: null };
    }
  });
