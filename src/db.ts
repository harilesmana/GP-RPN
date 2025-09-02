import { hashPassword } from "./utils/hash";

export type Role = "kepsek" | "guru" | "siswa";
export interface User {
  id: number;
  nama: string;
  email: string;
  password_hash: string;
  role: Role;
}

export const users: User[] = [];

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
      nama: "jokowi",
      email: "guru@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
    });
    users.push({
      id: 3,
      nama: "gibran",
      email: "siswa@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
    });
  }
}
await seed();
