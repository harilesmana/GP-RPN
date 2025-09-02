import { Elysia } from "elysia";

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"); 
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"); 

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = new Elysia()
  .derive(({ request, set }) => {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('cf-connecting-ip') || 
               'unknown';
    
    const now = Date.now();
    
    
    if (rateLimitStore.size > 10000) { 
      for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetTime < now) {
          rateLimitStore.delete(key);
        }
      }
    }
    
    let clientData = rateLimitStore.get(ip);
    
    if (!clientData || clientData.resetTime < now) {
      clientData = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
      rateLimitStore.set(ip, clientData);
    }
    
    clientData.count++;
    
    
    set.headers['X-RateLimit-Limit'] = MAX_REQUESTS.toString();
    set.headers['X-RateLimit-Remaining'] = Math.max(0, MAX_REQUESTS - clientData.count).toString();
    set.headers['X-RateLimit-Reset'] = Math.ceil(clientData.resetTime / 1000).toString();
    
    if (clientData.count > MAX_REQUESTS) {
      set.status = 429;
      set.headers['Retry-After'] = Math.ceil((clientData.resetTime - now) / 1000).toString();
      return { error: 'Terlalu banyak requests. Silakan coba lagi nanti.' };
    }
    
    return {};
  });
