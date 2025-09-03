import { Elysia, t } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { rateLimit } from '@elysiajs/rate-limit';
import { users, loginAttempts, User } from '../db';
import { comparePassword, hashPassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { securityHeaders } from '../middleware/security';
import { loginValidation, registerValidation, sanitizeInput } from '../utils/validation';
import * as ejs from 'ejs';
import { readFile } from 'fs/promises';
import path from 'path';

export const authRoutes = new Elysia()
  .use(staticPlugin({
    assets: 'public',
    prefix: '/public'
  }))
  .use(authMiddleware)
  .use(securityHeaders)
  .use(
    rateLimit({
      duration: 60000, 
      max: 5, 
      errorResponse: 'Terlalu banyak percobaan login'
    })
  )
  
  
  .get('/login', async ({ query, set }) => {
    try {
      const template = await readFile(path.join(process.cwd(), 'views', 'login.ejs'), 'utf-8');
      const html = ejs.render(template, { 
        error: query.error || null,
        message: query.message || null
      });
      
      set.headers['Content-Type'] = 'text/html';
      return html;
    } catch (error) {
      set.status = 500;
      return 'Error loading login page';
    }
  })
  
  
  .post('/login', async ({ body, set, cookie }) => {
    const { email, password } = body;

    
    const attempt = loginAttempts.get(email);
    if (attempt && attempt.unlockTime > Date.now()) {
      const remainingTime = Math.ceil((attempt.unlockTime - Date.now()) / 1000 / 60);
      set.redirect = `/login?error=Akun terkunci. Coba lagi dalam ${remainingTime} menit`;
      return;
    }

    
    const user = users.find(u => u.email === email && u.status === 'active');
    
    if (!user || !(await comparePassword(password, user.password_hash))) {
      
      const attemptCount = attempt ? attempt.count + 1 : 1;
      let unlockTime = 0;
      
      if (attemptCount >= 5) {
        unlockTime = Date.now() + 30 * 60 * 1000; 
      }
      
      loginAttempts.set(email, { count: attemptCount, unlockTime });
      
      set.redirect = '/login?error=Email atau password salah';
      return;
    }

    
    loginAttempts.delete(email);

    
    user.last_login = new Date();

    
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    
    cookie.auth.set({
      value: token,
      httpOnly: true,
      maxAge: 24 * 60 * 60, 
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    
    set.redirect = `/dashboard/${user.role}`;
  }, {
    body: loginValidation.body
  })
  
  
  .get('/register', async ({ query, set }) => {
    try {
      const template = await readFile(path.join(process.cwd(), 'views', 'register.ejs'), 'utf-8');
      const html = ejs.render(template, { 
        error: query.error || null,
        message: query.message || null
      });
      
      set.headers['Content-Type'] = 'text/html';
      return html;
    } catch (error) {
      set.status = 500;
      return 'Error loading registration page';
    }
  })
  
  
  .post('/register', async ({ body, set }) => {
    const { nama, email, password } = body;

    
    const sanitizedNama = sanitizeInput(nama);
    const sanitizedEmail = sanitizeInput(email);

    
    if (users.some(u => u.email === sanitizedEmail)) {
      set.redirect = '/register?error=Email sudah terdaftar';
      return;
    }

    
    const newUser: User = {
      id: users.length + 1,
      nama: sanitizedNama,
      email: sanitizedEmail,
      password_hash: await hashPassword(password),
      role: "siswa", 
      status: 'active',
      created_at: new Date()
    };

    users.push(newUser);

    set.status = 201;
    set.redirect = '/login?message=Registrasi berhasil. Silakan login.';
  }, {
    body: registerValidation.body
  })
  
  
  .get('/logout', ({ set, cookie }) => {
    cookie.auth.remove();
    set.redirect = '/login';
  });
