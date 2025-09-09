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

// PERBAIKAN: Gabungkan Tugas dan TugasDetail menjadi satu interface
export interface Tugas {
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

export interface MateriRead {
  id: number;
  siswa_id: number;
  materi_id: number;
  read_at: Date;
  duration_seconds?: number;
  scroll_percentage?: number;
}

export const users: User[] = [];
export const kelas: Kelas[] = [];
export const materi: Materi[] = [];
export const diskusi: Diskusi[] = [];
export const tugas: Tugas[] = [];
export const materiRead: MateriRead[] = [];
export const submissions: Submission[] = [];
export const diskusiMateri: DiskusiMateri[] = [];
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
      last_activity: new Date(Date.now() - 12 * 60 * 60 * 1000),
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
      last_login: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      login_count: 8,
      last_activity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      bidang: "Bahasa Indonesia"
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
      last_activity: now,
      bidang: "IPA"
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
      last_activity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      bidang: "IPS"
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
      last_activity: twoWeeksAgo,
      bidang: "Olahraga"
    });


    for (let i = 7; i <= 19; i++) {
      const status = i === 19 ? "inactive" : "active";
      const lastLogin = i % 3 === 0 ? now :
        i % 3 === 1 ? new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) :
          new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      users.push({
        id: i,
        nama: `Siswa ${i - 6}`,
        email: `siswa${i - 6}@example.com`,
        password_hash: await hashPassword("123456"),
        role: "siswa",
        status: status as "active" | "inactive",
        created_at: now,
        last_login: lastLogin,
        login_count: Math.floor(Math.random() * 20) + 1,
        last_activity: lastLogin,
        kelas_id: Math.floor((i - 7) / 4) + 1
      });
    }


    kelas.push({
      id: 1,
      nama: "Kelas 1A",
      tingkat: "1",
      wali_kelas_id: 2,
      created_at: now
    });

    kelas.push({
      id: 2,
      nama: "Kelas 2B",
      tingkat: "2",
      wali_kelas_id: 3,
      created_at: now
    });

    kelas.push({
      id: 3,
      nama: "Kelas 3C",
      tingkat: "3",
      wali_kelas_id: 4,
      created_at: now
    });


    for (let i = 1; i <= 10; i++) {
      materi.push({
        id: i,
        judul: `Materi Pembelajaran ${i}`,
        deskripsi: `Deskripsi materi pembelajaran ${i}`,
        konten: `Konten lengkap materi pembelajaran ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
        guru_id: Math.floor(Math.random() * 4) + 2,
        kelas_id: Math.floor(Math.random() * 3) + 1,
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      });
    }


    for (let i = 1; i <= 15; i++) {
      const userRole = i % 3 === 0 ? "guru" : "siswa";
      const userId = userRole === "guru" ?
        Math.floor(Math.random() * 5) + 2 :
        Math.floor(Math.random() * 12) + 7;

      diskusi.push({
        id: i,
        kelas: `Kelas ${Math.floor(Math.random() * 3) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
        isi: `Isi diskusi contoh ${i} untuk kelas`,
        user_id: userId,
        user_role: userRole as Role,
        created_at: new Date(Date.now() - i * 2 * 60 * 60 * 1000)
      });
    }

    // PERBAIKAN: Buat tugas dengan struktur yang konsisten
    for (let i = 1; i <= 5; i++) {
      const materiItem = materi[Math.floor(Math.random() * 10)];
      tugas.push({
        id: i,
        judul: `Tugas ${i}`,
        deskripsi: `Deskripsi tugas ${i}. Silakan kerjakan dengan baik dan benar.`,
        materi_id: materiItem.id,
        guru_id: materiItem.guru_id, // Pastikan guru_id konsisten dengan pemilik materi
        deadline: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // PERBAIKAN: Buat submissions yang konsisten dengan tugas yang ada
    let submissionId = 1;
    for (let tugasItem of tugas) {
      // Untuk setiap tugas, buat beberapa submission dari siswa berbeda
      const jumlahSubmission = Math.floor(Math.random() * 8) + 2; // 2-9 submissions per tugas

      for (let j = 0; j < jumlahSubmission; j++) {
        const siswaId = Math.floor(Math.random() * 12) + 7; // Siswa ID 7-18

        // Cek apakah siswa ini sudah submit untuk tugas ini
        const sudahSubmit = submissions.some(s => s.tugas_id === tugasItem.id && s.siswa_id === siswaId);
        if (sudahSubmit) continue;

        const statuses = ['dikerjakan', 'selesai'];
        const status = statuses[Math.floor(Math.random() * 2)];
        const isGraded = status === 'selesai' && Math.random() > 0.3; // 70% chance dinilai jika selesai

        submissions.push({
          id: submissionId++,
          tugas_id: tugasItem.id,
          siswa_id: siswaId,
          jawaban: `Jawaban tugas ${tugasItem.judul} dari siswa ${siswaId}`,
          nilai: isGraded ? Math.floor(Math.random() * 100) + 1 : undefined,
          feedback: isGraded ? 'Kerja bagus!' : undefined,
          submitted_at: new Date(Date.now() - (Math.random() * 5 * 24 * 60 * 60 * 1000)),
          graded_at: isGraded ? new Date(Date.now() - (Math.random() * 2 * 24 * 60 * 60 * 1000)) : undefined
        });
      }
    }


    for (let i = 1; i <= 15; i++) {
      const userRole = i % 3 === 0 ? "guru" : "siswa";
      const userId = userRole === "guru" ?
        Math.floor(Math.random() * 4) + 2 :
        Math.floor(Math.random() * 12) + 7;

      diskusiMateri.push({
        id: i,
        materi_id: Math.floor(Math.random() * 10) + 1,
        user_id: userId,
        user_role: userRole as Role,
        isi: `Pertanyaan atau komentar tentang materi ${i}`,
        parent_id: i > 5 ? Math.floor(Math.random() * 5) + 1 : undefined,
        created_at: new Date(Date.now() - (i * 2 * 60 * 60 * 1000))
      });
    }

    let readId = 1;
    for (let siswaId = 7; siswaId <= 15; siswaId++) {
      const siswa = users.find(u => u.id === siswaId);
      if (!siswa) continue;

      const materiForClass = materi.filter(m => m.kelas_id === siswa.kelas_id);

      // Setiap siswa sudah baca 30-70% materi di kelasnya
      const readCount = Math.floor(materiForClass.length * (0.3 + Math.random() * 0.4));
      const materiToRead = materiForClass.slice(0, readCount);

      materiToRead.forEach(m => {
        materiRead.push({
          id: readId++,
          siswa_id: siswaId,
          materi_id: m.id,
          read_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          duration_seconds: Math.floor(Math.random() * 600) + 60, // 1-10 menit
          scroll_percentage: Math.floor(Math.random() * 40) + 60 // 60-100%
        });
      });
    }
  }
}

await seed();