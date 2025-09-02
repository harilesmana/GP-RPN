import { hashPassword } from "./utils/hash";

export type Role = "kepsek" | "guru" | "siswa";

export interface User {
  id: number;
  nama: string;
  email: string;
  password_hash: string;
  role: Role;
}

export interface Materi {
  id: number;
  judul: string;
  deskripsi: string;
  created_by: number; 
  created_at: Date;
}

export const users: User[] = [];
export const materi: Materi[] = [];

async function seed() {
  if (users.length === 0) {
    users.push({
      id: 1,
      nama: "Prabowo",
      email: "kepsek@example.com",
      password_hash: await hashPassword("123456"),
      role: "kepsek",
    });
    users.push({
      id: 2,
      nama: "Jokowi",
      email: "guru@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
    });
    users.push({
      id: 3,
      nama: "Gibran",
      email: "siswa@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
    });
  }
}
await seed();
