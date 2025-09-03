import { Elysia } from 'elysia';
import { users, loginAttempts, User } from '../db';
import { comparePassword, hashPassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import * as ejs from 'ejs';
import { readFile } from 'fs/promises';
import path from 'path';

export const authRoutes = new Elysia()
  .use(authMiddleware)
  

  .get('/public/*', async ({ params, set }) => {
    try {
      const filePath = path.join(process.cwd(), 'public', params['*']);
      const file = Bun.file(filePath);
      
      if (await file.exists()) {
      
        if (filePath.endsWith('.css')) {
          set.headers['Content-Type'] = 'text/css';
        } else if (filePath.endsWith('.js')) {
          set.headers['Content-Type'] = 'application/javascript';
        } else if (filePath.endsWith('.png')) {
          set.headers['Content-Type'] = 'image/png';
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          set.headers['Content-Type'] = 'image/jpeg';
        }
        
        return file;
      } else {
        set.status = 404;
        return 'File not found';
      }
    } catch (error) {
      set.status = 500;
      return 'Error serving file';
    }
  })
  
  
  .get('/login', async ({ query, set }) => {
    try {
      console.log('Loading login page...');
      const templatePath = path.join(process.cwd(), 'views', 'login.ejs');
      console.log('Template path:', templatePath);
      
      const template = await readFile(templatePath, 'utf-8');
      const html = ejs.render(template, { 
        error: query.error || null,
        message: query.message || null
      });
      
      set.headers['Content-Type'] = 'text/html';
      return html;
    } catch (error) {
      console.error('Error loading login page:', error);
      set.status = 500;
      return `
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error loading login page</h1>
          <p>${error.message}</p>
          <p>Template path: ${path.join(process.cwd(), 'views', 'login.ejs')}</p>
        </body>
        </html>
      `;
    }
  })
  
  
  .post('/login', async ({ body, set, cookie }) => {
    try {
      const { email, password } = body as { email: string; password: string };
      console.log('Login attempt for:', email);

      
      const attempt = loginAttempts.get(email);
      if (attempt && attempt.unlockTime > Date.now()) {
        const remainingTime = Math.ceil((attempt.unlockTime - Date.now()) / 1000 / 60);
        set.status = 429;
        return `Akun terkunci. Coba lagi dalam ${remainingTime} menit`;
      }

      
      const user = users.find(u => u.email === email && u.status === 'active');
      
      if (!user || !(await comparePassword(password, user.password_hash))) {
    
        const attemptCount = attempt ? attempt.count + 1 : 1;
        let unlockTime = 0;
        
        if (attemptCount >= 5) {
          unlockTime = Date.now() + 30 * 60 * 1000; 
        }
        
        loginAttempts.set(email, { count: attemptCount, unlockTime });
        
        set.status = 401;
        return "Email atau password salah";
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
      return;
    } catch (error) {
      console.error('Login error:', error);
      set.status = 500;
      return "Terjadi kesalahan server";
    }
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
      console.error('Error loading register page:', error);
      set.status = 500;
      return 'Error loading registration page';
    }
  })
  

  .post('/register', async ({ body, set }) => {
    try {
      const { nama, email, password } = body as { nama: string; email: string; password: string };

      
      if (users.some(u => u.email === email)) {
        set.status = 400;
        return "Email sudah terdaftar";
      }

  
      if (nama.length < 3) {
        set.status = 400;
        return "Nama minimal 3 karakter";
      }

      if (password.length < 6) {
        set.status = 400;
        return "Password minimal 6 karakter";
      }

      if (!email.includes('@')) {
        set.status = 400;
        return "Email tidak valid";
      }

      
      const newUser: User = {
        id: users.length + 1,
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        password_hash: await hashPassword(password),
        role: "siswa", 
        status: 'active',
        created_at: new Date()
      };

      users.push(newUser);

      set.status = 201;
      set.redirect = '/login?message=Registrasi berhasil. Silakan login.';
      return;
    } catch (error) {
      console.error('Registration error:', error);
      set.status = 500;
      return "Terjadi kesalahan server";
    }
  })
  
  // Logout
  .get('/logout', ({ set, cookie }) => {
    cookie.auth.remove();
    set.redirect = '/login';
    return;
  });
