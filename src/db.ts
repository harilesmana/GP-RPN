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
  guru_id: number; 
  created_at: Date;
}

export type StatusTugas = "belum dikumpulkan" | "terkumpul" | "dinilai";

export interface Tugas {
  id: number;
  materi_id: number;
  siswa_id: number;
  status: StatusTugas;
  nilai?: number; 
  hasil_akhir?: string; 
  dikumpulkan_at?: Date;
  dinilai_at?: Date;
}

export interface GuruInfo {
  user_id: number;
  bidang: string; 
}

export const users: User[] = [];
export const materiList: Materi[] = [];
export const tugasList: Tugas[] = [];
export const guruInfoList: GuruInfo[] = [];
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

  
    guruInfoList.push({
      user_id: 2,
      bidang: "IT"
    });


    materiList.push({
      id: 1,
      judul: "Pengenalan TypeScript",
      deskripsi: "Belajar dasar-dasar TypeScript",
      guru_id: 2,
      created_at: now
    });

  
    tugasList.push({
      id: 1,
      materi_id: 1,
      siswa_id: 3,
      status: "belum dikumpulkan"
    });
  }
}

await seed();
