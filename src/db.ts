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
  login_count?: number;
  last_activity?: Date;
  bidang?: string;
  kelas_id?: number;
}

export interface Kelas {
  id: number;
  nama: string;
  tingkat: string;
  wali_kelas_id: number;
  created_at: Date;
}

export interface Materi {
  id: number;
  judul: string;
  deskripsi: string;
  konten: string;
  guru_id: number;
  kelas_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface Diskusi {
  id: number;
  kelas: string;
  isi: string;
  user_id: number;
  user_role: Role;
  created_at: Date;
}

export interface Tugas {
  id: number;
  materi_id: number;
  siswa_id: number;
  status: 'belum_dikerjakan' | 'dikerjakan' | 'selesai';
  nilai?: number;
  hasil?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TugasDetail {
  id: number;
  judul: string;
  deskripsi: string;
  materi_id: number;
  guru_id: number;
  deadline: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Submission {
  id: number;
  tugas_id: number;
  siswa_id: number;
  jawaban: string;
  nilai?: number;
  feedback?: string;
  submitted_at: Date;
  graded_at?: Date;
}

export interface DiskusiMateri {
  id: number;
  materi_id: number;
  user_id: number;
  user_role: Role;
  isi: string;
  parent_id?: number;
  created_at: Date;
}

export const users: User[] = [];
export const kelas: Kelas[] = [];
export const materi: Materi[] = [];
export const diskusi: Diskusi[] = [];
export const tugas: Tugas[] = [];
export const tugasDetail: TugasDetail[] = [];
export const submissions: Submission[] = [];
export const diskusiMateri: DiskusiMateri[] = [];
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
      last_login: now,
      login_count: 10,
      last_activity: now
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
      last_login: now,
      login_count: 8,
      last_activity: now,
      bidang: "Matematika"
    });

    users.push({
      id: 3,
      nama: "Megawati",
      email: "guru2@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
      status: "active",
      created_by: 1,
      created_at: now,
      last_login: now,
      login_count: 6,
      last_activity: now,
      bidang: "Bahasa Indonesia"
    });

    
    
    
    kelas.push({
      id: 1,
      nama: "Kelas 1A",
      tingkat: "1",
      wali_kelas_id: 2,
      created_at: now
    });

    
    
    
    users.push({
      id: 4,
      nama: "Siswa 1",
      email: "siswa1@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 3,
      last_activity: now,
      kelas_id: 1
    });

    
    
    
    materi.push({
      id: 1,
      judul: "Materi 1",
      deskripsi: "Deskripsi materi 1",
      konten: "Konten lengkap materi 1",
      guru_id: 2,
      kelas_id: 1,
      created_at: now,
      updated_at: now
    });

    materi.push({
      id: 2,
      judul: "Materi 2",
      deskripsi: "Deskripsi materi 2",
      konten: "Konten lengkap materi 2",
      guru_id: 3,
      kelas_id: 1,
      created_at: now,
      updated_at: now
    });

    materi.push({
      id: 3,
      judul: "Materi 3",
      deskripsi: "Deskripsi materi 3",
      konten: "Konten lengkap materi 3",
      guru_id: 2,
      kelas_id: 1,
      created_at: now,
      updated_at: now
    });

    
    
    
    tugasDetail.push({
      id: 1,
      judul: "Tugas 1",
      deskripsi: "Deskripsi tugas 1",
      materi_id: 1,
      guru_id: 2,
      deadline: new Date(Date.now() + 1 * 86400000),
      created_at: now,
      updated_at: now
    });

    tugasDetail.push({
      id: 2,
      judul: "Tugas 2",
      deskripsi: "Deskripsi tugas 2",
      materi_id: 2,
      guru_id: 3,
      deadline: new Date(Date.now() + 2 * 86400000),
      created_at: now,
      updated_at: now
    });

    tugasDetail.push({
      id: 3,
      judul: "Tugas 3",
      deskripsi: "Deskripsi tugas 3",
      materi_id: 3,
      guru_id: 2,
      deadline: new Date(Date.now() + 3 * 86400000),
      created_at: now,
      updated_at: now
    });

    
    
    
    tugas.push({
      id: 1,
      materi_id: 1,
      siswa_id: 4,
      status: "belum_dikerjakan",
      created_at: now,
      updated_at: now
    });

    tugas.push({
      id: 2,
      materi_id: 2,
      siswa_id: 4,
      status: "dikerjakan",
      created_at: now,
      updated_at: now
    });

    submissions.push({
      id: 2,
      tugas_id: 2,
      siswa_id: 4,
      jawaban: "Jawaban tugas 2 dari siswa 1",
      submitted_at: now
    });

    tugas.push({
      id: 3,
      materi_id: 3,
      siswa_id: 4,
      status: "selesai",
      nilai: 90,
      hasil: "Hasil tugas 3",
      created_at: now,
      updated_at: now
    });

    submissions.push({
      id: 3,
      tugas_id: 3,
      siswa_id: 4,
      jawaban: "Jawaban tugas 3 dari siswa 1",
      nilai: 90,
      feedback: "Bagus sekali",
      submitted_at: now,
      graded_at: now
    });

    
    
    
    diskusi.push({
      id: 1,
      kelas: "Kelas 1A",
      isi: "Pak, saya mau tanya soal materi pertama.",
      user_id: 4,
      user_role: "siswa",
      created_at: now
    });

    diskusi.push({
      id: 2,
      kelas: "Kelas 1A",
      isi: "Silakan, apa yang belum dipahami?",
      user_id: 2,
      user_role: "guru",
      created_at: now
    });

    
    
    
    diskusiMateri.push({
      id: 1,
      materi_id: 1,
      user_id: 4,
      user_role: "siswa",
      isi: "Saya bingung di bagian contoh soal nomor 2.",
      created_at: now
    });

    diskusiMateri.push({
      id: 2,
      materi_id: 1,
      user_id: 2,
      user_role: "guru",
      isi: "Baik, saya jelaskan kembali ya.",
      parent_id: 1,
      created_at: now
    });
  }
}

await seed();