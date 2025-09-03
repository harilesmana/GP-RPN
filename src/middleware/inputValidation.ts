import { Elysia } from "elysia";
import { z } from 'zod';


export const loginSchema = z.object({
  email: z.string().email("Email tidak valid").min(5, "Email terlalu pendek").max(100, "Email terlalu panjang"),
  password: z.string().min(6, "Password minimal 6 karakter").max(100, "Password terlalu panjang")
});

export const registerSchema = z.object({
  nama: z.string()
    .min(2, "Nama minimal 2 karakter")
    .max(50, "Nama maksimal 50 karakter")
    .regex(/^[a-zA-Z\s]+$/, "Nama hanya boleh mengandung huruf dan spasi"),
  email: z.string().email("Email tidak valid").max(100, "Email terlalu panjang"),
  password: z.string()
    .min(6, "Password minimal 6 karakter")
    .max(100, "Password terlalu panjang")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password harus mengandung huruf besar, huruf kecil, dan angka")
});

export const materiSchema = z.object({
  judul: z.string()
    .min(5, "Judul minimal 5 karakter")
    .max(100, "Judul maksimal 100 karakter")
    .regex(/^[a-zA-Z0-9\s.,!?-]+$/, "Judul mengandung karakter tidak valid"),
  deskripsi: z.string()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(1000, "Deskripsi maksimal 1000 karakter")
});

export const komentarSchema = z.object({
  isi: z.string()
    .min(1, "Komentar tidak boleh kosong")
    .max(500, "Komentar maksimal 500 karakter")
    .regex(/^[a-zA-Z0-9\s.,!?-]+$/, "Komentar mengandung karakter tidak valid")
});

export const quizSchema = z.object({
  materi_id: z.number().min(1, "Materi ID harus valid"),
  judul: z.string()
    .min(5, "Judul quiz minimal 5 karakter")
    .max(100, "Judul quiz maksimal 100 karakter")
});

export const pertanyaanSchema = z.object({
  quiz_id: z.number().min(1, "Quiz ID harus valid"),
  teks: z.string()
    .min(10, "Teks pertanyaan minimal 10 karakter")
    .max(500, "Teks pertanyaan maksimal 500 karakter"),
  opsi_a: z.string().min(1, "Opsi A tidak boleh kosong").max(200, "Opsi A maksimal 200 karakter"),
  opsi_b: z.string().min(1, "Opsi B tidak boleh kosong").max(200, "Opsi B maksimal 200 karakter"),
  opsi_c: z.string().min(1, "Opsi C tidak boleh kosong").max(200, "Opsi C maksimal 200 karakter"),
  opsi_d: z.string().min(1, "Opsi D tidak boleh kosong").max(200, "Opsi D maksimal 200 karakter"),
  jawaban_benar: z.enum(['a', 'b', 'c', 'd'], {
    errorMap: () => ({ message: "Jawaban benar harus a, b, c, atau d" })
  })
});

export const jawabanSchema = z.object({
  jawaban: z.record(
    z.string(),
    z.enum(['a', 'b', 'c', 'd'])
  )
});

export const addGuruSchema = z.object({
  nama: z.string()
    .min(2, "Nama minimal 2 karakter")
    .max(50, "Nama maksimal 50 karakter")
    .regex(/^[a-zA-Z\s]+$/, "Nama hanya boleh mengandung huruf dan spasi"),
  email: z.string().email("Email tidak valid").max(100, "Email terlalu panjang"),
  password: z.string()
    .min(6, "Password minimal 6 karakter")
    .max(100, "Password terlalu panjang")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password harus mengandung huruf besar, huruf kecil, dan angka")
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  user_id: z.number().min(1, "User ID harus valid")
});


export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#96;');
}

export const inputValidation = new Elysia()
  .derive(({ body }) => {

    if (body && typeof body === 'object') {
      const sanitizedBody: any = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          sanitizedBody[key] = sanitizeInput(value);
        } else {
          sanitizedBody[key] = value;
        }
      }
      return { sanitizedBody };
    }
    return { sanitizedBody: body };
  });
