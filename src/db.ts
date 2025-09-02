import { hashPassword } from "./utils/hash";

export type Role = "kepsek" | "guru" | "siswa";

export interface User {
  id: number;
  nama: string;
  email: string;
  password_hash: string;
  role: Role;
  status: 'active' | 'inactive';
  created_by?: number;
  created_at: Date;
  last_login?: Date;
}

export interface Materi {
  id: number;
  judul: string;
  deskripsi: string;
  created_by: number;
  created_at: Date;
  updated_at?: Date;
}

export interface Komentar {
  id: number;
  materi_id: number;
  user_id: number;
  isi: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Quiz {
  id: number;
  materi_id: number;
  judul: string;
  created_by: number;
  created_at: Date;
  updated_at?: Date;
}

export interface Pertanyaan {
  id: number;
  quiz_id: number;
  teks: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  jawaban_benar: 'a' | 'b' | 'c' | 'd';
  created_at: Date;
}

export interface Nilai {
  id: number;
  quiz_id: number;
  user_id: number;
  skor: number;
  total_pertanyaan: number;
  created_at: Date;
}

export const users: User[] = [];
export const materi: Materi[] = [];
export const komentar: Komentar[] = [];
export const quiz: Quiz[] = [];
export const pertanyaan: Pertanyaan[] = [];
export const nilai: Nilai[] = [];


export const loginAttempts = new Map<string, { count: number; unlockTime: number }>();

async function seed() {
  if (users.length === 0) {
    const now = new Date();
    
    users.push({
      id: 1,
      nama: "Prabowo",
      email: "kepsek@example.com",
      password_hash: await hashPassword("123456"),
      role: "kepsek",
      status: "active",
      created_at: now,
      last_login: now
    });
    
    users.push({
      id: 2,
      nama: "Jokowi",
      email: "guru@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
      status: "active",
      created_by: 1,
      created_at: now,
      last_login: now
    });
    
    users.push({
      id: 3,
      nama: "Gibran",
      email: "siswa@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now
    });
    
    
    materi.push({
      id: 1,
      judul: "Matematika Dasar",
      deskripsi: "Pengenalan konsep matematika dasar untuk pemula",
      created_by: 2,
      created_at: now
    });
    
    materi.push({
      id: 2,
      judul: "Bahasa Indonesia",
      deskripsi: "Pelajaran bahasa Indonesia untuk kelas 10 semester 1",
      created_by: 1,
      created_at: now
    });
    
    
    komentar.push({
      id: 1,
      materi_id: 1,
      user_id: 3,
      isi: "Materi sangat membantu memahami dasar-dasar matematika!",
      created_at: now
    });
    
    komentar.push({
      id: 2,
      materi_id: 1,
      user_id: 2,
      isi: "Silakan bertanya jika ada bagian yang tidak dimengerti",
      created_at: now
    });
    
    komentar.push({
      id: 3,
      materi_id: 2,
      user_id: 3,
      isi: "Terima kasih untuk materinya, sangat bermanfaat!",
      created_at: now
    });

    
    quiz.push({
      id: 1,
      materi_id: 1,
      judul: "Quiz Matematika Dasar - Bagian 1",
      created_by: 2,
      created_at: now
    });

    quiz.push({
      id: 2,
      materi_id: 2,
      judul: "Quiz Bahasa Indonesia - Tata Bahasa",
      created_by: 1,
      created_at: now
    });

    
    pertanyaan.push({
      id: 1,
      quiz_id: 1,
      teks: "Berapakah hasil dari 7 + 5?",
      opsi_a: "10",
      opsi_b: "11",
      opsi_c: "12",
      opsi_d: "13",
      jawaban_benar: "c",
      created_at: now
    });

    pertanyaan.push({
      id: 2,
      quiz_id: 1,
      teks: "Apa hasil dari 15 - 8?",
      opsi_a: "5",
      opsi_b: "6",
      opsi_c: "7",
      opsi_d: "8",
      jawaban_benar: "c",
      created_at: now
    });

    pertanyaan.push({
      id: 3,
      quiz_id: 2,
      teks: "Manakah yang merupakan kata benda?",
      opsi_a: "berlari",
      opsi_b: "cepat",
      opsi_c: "buku",
      opsi_d: "indah",
      jawaban_benar: "c",
      created_at: now
    });

    
    nilai.push({
      id: 1,
      quiz_id: 1,
      user_id: 3,
      skor: 2,
      total_pertanyaan: 2,
      created_at: now
    });
  }
}

await seed();
