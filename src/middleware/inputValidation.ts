import { Elysia } from "elysia";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid").min(5).max(100),
  password: z.string().min(6, "Password minimal 6 karakter").max(100)
});

export const registerSchema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().email("Email tidak valid").min(5).max(100),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  confirmPassword: z.string().min(6, "Konfirmasi password minimal 6 karakter").max(100),
});

export const addGuruSchema = z.object({
  nama: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

export const updateUserStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["active", "inactive"])
});




export const inputValidation = new Elysia()
  .onParse(async ({ request, contentType }) => {
    
    if (contentType === 'multipart/form-data') {
      const formData = await request.formData();
      const body: Record<string, any> = {};
      
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
      
      return body;
    }
    
    
    return undefined;
  });