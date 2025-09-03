import { t } from 'elysia';

export const loginValidation = {
  body: t.Object({
    email: t.String({ format: 'email', error: 'Email tidak valid' }),
    password: t.String({ 
      minLength: 6, 
      error: 'Password minimal 6 karakter' 
    })
  })
};

export const registerValidation = {
  body: t.Object({
    nama: t.String({ 
      minLength: 3, 
      maxLength: 50, 
      error: 'Nama harus 3-50 karakter' 
    }),
    email: t.String({ 
      format: 'email', 
      error: 'Email tidak valid' 
    }),
    password: t.String({ 
      minLength: 6,
      error: 'Password minimal 6 karakter'
    })
  })
};
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};
