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
  { id: 2, nama: "X IPA 2", wali_kelas_id: 3, created_at: new Date() },
  { id: 3, nama: "XI IPS 1", wali_kelas_id: 4, created_at: new Date() },
  { id: 4, nama: "XI IPS 2", wali_kelas_id: 5, created_at: new Date() },
  { id: 5, nama: "XII IPA 1", wali_kelas_id: 6, created_at: new Date() },
];

export const mataPelajaran: MataPelajaran[] = [
  { id: 1, nama: "Matematika", deskripsi: "Matematika Dasar", created_at: new Date() },
  { id: 2, nama: "Bahasa Indonesia", deskripsi: "Bahasa Indonesia", created_at: new Date() },
  { id: 3, nama: "IPA", deskripsi: "Ilmu Pengetahuan Alam", created_at: new Date() },
  { id: 4, nama: "IPS", deskripsi: "Ilmu Pengetahuan Sosial", created_at: new Date() },
  { id: 5, nama: "Bahasa Inggris", deskripsi: "Bahasa Inggris", created_at: new Date() },
  { id: 6, nama: "PKN", deskripsi: "Pendidikan Kewarganegaraan", created_at: new Date() },
];

export const guruMengajar: GuruMengajar[] = [
  { id: 1, guru_id: 2, mata_pelajaran_id: 1, kelas_id: 1, created_at: new Date() },
  { id: 2, guru_id: 2, mata_pelajaran_id: 2, kelas_id: 2, created_at: new Date() },
  { id: 3, guru_id: 3, mata_pelajaran_id: 3, kelas_id: 1, created_at: new Date() },
  { id: 4, guru_id: 4, mata_pelajaran_id: 4, kelas_id: 3, created_at: new Date() },
  { id: 5, guru_id: 5, mata_pelajaran_id: 5, kelas_id: 4, created_at: new Date() },
  { id: 6, guru_id: 6, mata_pelajaran_id: 6, kelas_id: 5, created_at: new Date() },
];

export const siswaKelas: SiswaKelas[] = [
  { id: 1, siswa_id: 7, kelas_id: 1, created_at: new Date() },
  { id: 2, siswa_id: 8, kelas_id: 1, created_at: new Date() },
  { id: 3, siswa_id: 9, kelas_id: 1, created_at: new Date() },
  { id: 4, siswa_id: 10, kelas_id: 1, created_at: new Date() },
  { id: 5, siswa_id: 11, kelas_id: 2, created_at: new Date() },
  { id: 6, siswa_id: 12, kelas_id: 2, created_at: new Date() },
  { id: 7, siswa_id: 13, kelas_id: 2, created_at: new Date() },
  { id: 8, siswa_id: 14, kelas_id: 3, created_at: new Date() },
  { id: 9, siswa_id: 15, kelas_id: 3, created_at: new Date() },
  { id: 10, siswa_id: 16, kelas_id: 4, created_at: new Date() },
  { id: 11, siswa_id: 17, kelas_id: 4, created_at: new Date() },
  { id: 12, siswa_id: 18, kelas_id: 5, created_at: new Date() },
  { id: 13, siswa_id: 19, kelas_id: 5, created_at: new Date() },
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
  { 
    id: 3, 
    judul: "Tugas IPA - Struktur Sel", 
    deskripsi: "Gambar dan jelaskan struktur sel hewan dan tumbuhan", 
    mata_pelajaran_id: 3, 
    kelas_id: 1, 
    created_by: 3, 
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 
    created_at: new Date() 
  },
  { 
    id: 4, 
    judul: "Tugas IPS - Sejarah Kemerdekaan", 
    deskripsi: "Buat timeline peristiwa kemerdekaan Indonesia", 
    mata_pelajaran_id: 4, 
    kelas_id: 3, 
    created_by: 4, 
    deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) 
  },
  { 
    id: 5, 
    judul: "Tugas Bahasa Inggris - Present Tense", 
    deskripsi: "Buat 10 kalimat menggunakan present tense", 
    mata_pelajaran_id: 5, 
    kelas_id: 4, 
    created_by: 5, 
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), 
    created_at: new Date() 
  }
];

export const tugasSiswa: TugasSiswa[] = [
  { id: 1, tugas_id: 1, siswa_id: 7, status: 'selesai', nilai: 85, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 2, tugas_id: 1, siswa_id: 8, status: 'belum', created_at: new Date() },
  { id: 3, tugas_id: 1, siswa_id: 9, status: 'selesai', nilai: 90, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 4, tugas_id: 1, siswa_id: 10, status: 'selesai', nilai: 78, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 5, tugas_id: 2, siswa_id: 11, status: 'belum', created_at: new Date() },
  { id: 6, tugas_id: 2, siswa_id: 12, status: 'selesai', nilai: 92, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 7, tugas_id: 2, siswa_id: 13, status: 'selesai', nilai: 88, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 8, tugas_id: 3, siswa_id: 7, status: 'selesai', nilai: 95, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 9, tugas_id: 3, siswa_id: 8, status: 'selesai', nilai: 82, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 10, tugas_id: 3, siswa_id: 9, status: 'selesai', nilai: 79, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 11, tugas_id: 3, siswa_id: 10, status: 'selesai', nilai: 91, dikumpulkan_pada: new Date(), created_at: new Date() },
  { id: 12, tugas_id: 4, siswa_id: 14, status: 'selesai', nilai: 65, dikumpulkan_pada: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), created_at: new Date() },
  { id: 13, tugas_id: 4, siswa_id: 15, status: 'selesai', nilai: 72, dikumpulkan_pada: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), created_at: new Date() },
  { id: 14, tugas_id: 5, siswa_id: 16, status: 'belum', created_at: new Date() },
  { id: 15, tugas_id: 5, siswa_id: 17, status: 'selesai', nilai: 84, dikumpulkan_pada: new Date(), created_at: new Date() }
];

export const diskusi: Diskusi[] = [
  { id: 1, topik: "Pembahasan Tugas Matematika", pesan: "Ada yang tidak mengerti soal nomor 5?", pengirim_id: 7, target_type: 'tugas', target_id: 1, created_at: new Date() },
  { id: 2, topik: "Pengumuman Kelas", pesan: "Besok ada kegiatan pramuka", pengirim_id: 2, target_type: 'kelas', target_id: 1, created_at: new Date() },
  { id: 3, topik: "Klarifikasi Deadline", pesan: "Apakah deadline tugas IPS bisa diperpanjang?", pengirim_id: 14, target_type: 'tugas', target_id: 4, created_at: new Date() },
  { id: 4, topik: "Jawaban Soal No. 3", pesan: "Untuk soal no. 3, jawabannya adalah...", pengirim_id: 2, target_type: 'tugas', target_id: 1, created_at: new Date() },
  { id: 5, topik: "Libur Nasional", pesan: "Minggu depan libur nasional, jadwal belajar menyesuaikan", pengirim_id: 1, target_type: 'kelas', target_id: 1, created_at: new Date() }
];

export const loginAttempts = new Map<string, { count: number; unlockTime: number }>();

async function seed() {
  if (users.length === 0) {
    const now = new Date();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    users.push({
      id: 1,
      nama: "Prabowo",
      email: "kepsek@example.com",
      password_hash: await hashPassword("123456"),
      role: "kepsek",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 15,
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
      last_login: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      login_count: 12,
      last_activity: new Date(Date.now() - 12 * 60 * 60 * 1000)
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
      last_login: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      login_count: 8,
      last_activity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });
    
    users.push({
      id: 4,
      nama: "SBY",
      email: "guru3@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
      status: "active",
      created_by: 1,
      created_at: now,
      last_login: now,
      login_count: 20,
      last_activity: now
    });
    
    users.push({
      id: 5,
      nama: "Gus Dur",
      email: "guru4@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
      status: "active",
      created_by: 1,
      created_at: now,
      last_login: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      login_count: 5,
      last_activity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    });
    
    users.push({
      id: 6,
      nama: "Wiranto",
      email: "guru5@example.com",
      password_hash: await hashPassword("123456"),
      role: "guru",
      status: "inactive",
      created_by: 1,
      created_at: now,
      last_login: twoWeeksAgo,
      login_count: 3,
      last_activity: twoWeeksAgo
    });

    users.push({
      id: 7,
      nama: "Gibran",
      email: "siswa1@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 18,
      last_activity: now
    });

    users.push({
      id: 8,
      nama: "Budi",
      email: "siswa2@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      login_count: 10,
      last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    users.push({
      id: 9,
      nama: "Susi",
      email: "siswa3@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 15,
      last_activity: now
    });

    users.push({
      id: 10,
      nama: "Andi",
      email: "siswa4@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      login_count: 7,
      last_activity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    });

    users.push({
      id: 11,
      nama: "Rina",
      email: "siswa5@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 12,
      last_activity: now
    });

    users.push({
      id: 12,
      nama: "Dodi",
      email: "siswa6@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: oneWeekAgo,
      login_count: 6,
      last_activity: oneWeekAgo
    });

    users.push({
      id: 13,
      nama: "Lina",
      email: "siswa7@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 9,
      last_activity: now
    });

    users.push({
      id: 14,
      nama: "Rudi",
      email: "siswa8@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      login_count: 8,
      last_activity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });

    users.push({
      id: 15,
      nama: "Dewi",
      email: "siswa9@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 11,
      last_activity: now
    });

    users.push({
      id: 16,
      nama: "Fajar",
      email: "siswa10@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      login_count: 4,
      last_activity: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    });

    users.push({
      id: 17,
      nama: "Gita",
      email: "siswa11@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 13,
      last_activity: now
    });

    users.push({
      id: 18,
      nama: "Hendra",
      email: "siswa12@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "active",
      created_at: now,
      last_login: oneWeekAgo,
      login_count: 5,
      last_activity: oneWeekAgo
    });

    users.push({
      id: 19,
      nama: "Indra",
      email: "siswa13@example.com",
      password_hash: await hashPassword("123456"),
      role: "siswa",
      status: "inactive",
      created_at: now,
      last_login: twoWeeksAgo,
      login_count: 2,
      last_activity: twoWeeksAgo
    });
  }
}

await seed();
