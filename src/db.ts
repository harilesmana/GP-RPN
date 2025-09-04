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

export interface Kelas {
  id: number;
  nama: string;
  wali_kelas_id: number;
  created_at: Date;
}

export interface MataPelajaran {
  id: number;
  nama: string;
  deskripsi: string;
  created_at: Date;
}

export interface GuruMengajar {
  id: number;
  guru_id: number;
  mata_pelajaran_id: number;
  kelas_id: number;
  created_at: Date;
}

export interface Tugas {
  id: number;
  judul: string;
  deskripsi: string;
  mata_pelajaran_id: number;
  kelas_id: number;
  created_by: number;
  deadline: Date;
  created_at: Date;
}

export interface TugasSiswa {
  id: number;
  tugas_id: number;
  siswa_id: number;
  status: 'selesai' | 'belum';
  nilai?: number;
  dikumpulkan_pada?: Date;
  created_at: Date;
}

export interface Diskusi {
  id: number;
  topik: string;
  pesan: string;
  pengirim_id: number;
  target_type: 'kelas' | 'tugas';
  target_id: number;
  created_at: Date;
}

export interface SiswaKelas {
  id: number;
  siswa_id: number;
  kelas_id: number;
  created_at: Date;
}

export const users: User[] = [];
export const classes: Kelas[] = [
  { id: 1, nama: "X IPA 1", wali_kelas_id: 2, created_at: new Date() },
  { id: 2, nama: "X IPA 2", wali_kelas_id: 2, created_at: new Date() },
  { id: 3, nama: "XI IPS 1", wali_kelas_id: 2, created_at: new Date() },
];

export const mataPelajaran: MataPelajaran[] = [
  { id: 1, nama: "Matematika", deskripsi: "Matematika Dasar", created_at: new Date() },
  { id: 2, nama: "Bahasa Indonesia", deskripsi: "Bahasa Indonesia", created_at: new Date() },
  { id: 3, nama: "IPA", deskripsi: "Ilmu Pengetahuan Alam", created_at: new Date() },
];

export const guruMengajar: GuruMengajar[] = [
  { id: 1, guru_id: 2, mata_pelajaran_id: 1, kelas_id: 1, created_at: new Date() },
  { id: 2, guru_id: 2, mata_pelajaran_id: 2, kelas_id: 2, created_at: new Date() },
];

export const siswaKelas: SiswaKelas[] = [
  { id: 1, siswa_id: 3, kelas_id: 1, created_at: new Date() },
  { id: 2, siswa_id: 4, kelas_id: 1, created_at: new Date() },
  { id: 3, siswa_id: 5, kelas_id: 1, created_at: new Date() },
];

export const tasks: Tugas[] = [
  { 
    id: 1, 
    judul: "Tugas Matematika 1", 
    deskripsi: "Kerjakan soal halaman 10", 
    mata_pelajaran_id: 1, 
    kelas_id: 1, 
    created_by: 2, 
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
    created_at: new Date() 
  },
  { 
    id: 2, 
    judul: "Tugas Bahasa Indonesia", 
    deskripsi: "Buat ringkasan cerpen", 
    mata_pelajaran_id: 2, 
    kelas_id: 2, 
    created_by: 2, 
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 
    created_at: new Date() 
  },
];

export const tugasSiswa: TugasSiswa[] = [
  { id: 1, tugas_id: 1, siswa_id: 3, status: 'selesai', nilai: 85, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 2, tugas_id: 1, siswa_id: 4, status: 'belum', created_at: new Date() },
  { id: 3, tugas_id: 1, siswa_id: 5, status: 'selesai', nilai: 90, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 4, tugas_id: 2, siswa_id: 3, status: 'belum', created_at: new Date() },
];

export const diskusi: Diskusi[] = [
  { id: 1, topik: "Pembahasan Tugas Matematika", pesan: "Ada yang tidak mengerti soal nomor 5?", pengirim_id: 3, target_type: 'tugas', target_id: 1, created_at: new Date() },
  { id: 2, topik: "Pengumuman Kelas", pesan: "Besok ada kegiatan pramuka", pengirim_id: 2, target_type: 'kelas', target_id: 1, created_at: new Date() },
];

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
      email: "siswa1@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now
    });

    users.push({
      id: 4,
      nama: "Budi",
      email: "siswa2@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now
    });

    users.push({
      id: 5,
      nama: "Susi",
      email: "siswa3@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now
    });
  }
}

await seed();
