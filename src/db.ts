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
  judul: string;
  deskripsi: string;
  materi_id: number;
  guru_id: number;
  deadline: Date;
  created_at: Date;
  updated_at: Date;
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


export interface SiswaTugas {
  id: number;
  siswa_id: number;
  tugas_id: number;
  jawaban?: string;
  nilai?: number;
  feedback?: string;
  status: 'belum_dikerjakan' | 'dikerjakan' | 'selesai';
  submitted_at?: Date;
  graded_at?: Date;
}

export interface SiswaMateri {
  id: number;
  siswa_id: number;
  materi_id: number;
  last_accessed: Date;
  is_completed: boolean;
}

export interface GuruKelas {
  id: number;
  guru_id: number;
  kelas_id: number;
  mata_pelajaran: string;
}

export const users: User[] = [];
export const kelas: Kelas[] = [];
export const materi: Materi[] = [];
export const diskusi: Diskusi[] = [];
export const tugas: Tugas[] = [];
export const diskusiMateri: DiskusiMateri[] = [];
export const siswaTugas: SiswaTugas[] = [];
export const siswaMateri: SiswaMateri[] = [];
export const guruKelas: GuruKelas[] = [];
export const loginAttempts = new Map<string, { count: number; unlockTime: number }>();


export function getTugasForKelas(kelasId: number) {
  return tugas.filter(t => {
    const materiItem = materi.find(m => m.id === t.materi_id);
    return materiItem && materiItem.kelas_id === kelasId;
  });
}

export function getSubmissionForSiswa(siswaId: number, tugasId?: number) {
  if (tugasId) {
    return siswaTugas.find(st => st.siswa_id === siswaId && st.tugas_id === tugasId);
  }
  return siswaTugas.filter(st => st.siswa_id === siswaId);
}

export function getMateriProgressForSiswa(siswaId: number, materiId?: number) {
  if (materiId) {
    return siswaMateri.find(sm => sm.siswa_id === siswaId && sm.materi_id === materiId);
  }
  return siswaMateri.filter(sm => sm.siswa_id === siswaId);
}

export function getTugasWithStatus(siswaId: number, kelasId: number) {
  const tugasUntukKelas = getTugasForKelas(kelasId);
  
  return tugasUntukKelas.map(tugasItem => {
    const submission = getSubmissionForSiswa(siswaId, tugasItem.id);
    const materiItem = materi.find(m => m.id === tugasItem.materi_id);
    
    return {
      ...tugasItem,
      status: submission?.status || 'belum_dikerjakan',
      nilai: submission?.nilai,
      feedback: submission?.feedback,
      jawaban: submission?.jawaban,
      submitted_at: submission?.submitted_at,
      graded_at: submission?.graded_at,
      materi_judul: materiItem?.judul || "Tidak diketahui"
    };
  });
}

async function seed() {
  if (users.length === 0) {
    const now = new Date();
    
    
    users.push({
      id: 1,
      nama: "Dr. Prabowo, M.Pd",
      email: "kepsek@example.com",
      password_hash: await hashPassword("123456"),
      role: "kepsek",
      status: "active",
      created_at: now,
      last_login: now,
      login_count: 15,
      last_activity: now
    });
    
    
    const guruData = [
      { id: 2, nama: "Jokowi, S.Pd", email: "guru@example.com", bidang: "Matematika" },
      { id: 3, nama: "Megawati, S.Pd", email: "guru2@example.com", bidang: "Bahasa Indonesia" },
      { id: 4, nama: "SBY, S.Pd", email: "guru3@example.com", bidang: "IPA" },
      { id: 5, nama: "Gus Dur, S.Pd", email: "guru4@example.com", bidang: "IPS" },
      { id: 6, nama: "Wiranto, S.Pd", email: "guru5@example.com", bidang: "Olahraga" }
    ];
    
    guruData.forEach((guru, index) => {
      users.push({
        ...guru,
        password_hash: await hashPassword("123456"),
        role: "guru",
        status: index === 4 ? "inactive" : "active",
        created_by: 1,
        created_at: now,
        last_login: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
        login_count: Math.floor(Math.random() * 20) + 1,
        last_activity: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000)
      });
    });
    
    
    for (let i = 7; i <= 19; i++) {
      const status = i === 19 ? "inactive" : "active";
      const lastLogin = new Date(Date.now() - (i % 3) * 24 * 60 * 60 * 1000);
      
      users.push({
        id: i,
        nama: `Siswa ${i-6}`,
        email: `siswa${i-6}@example.com`,
        password_hash: await hashPassword("123456"),
        role: "siswa",
        status: status,
        created_at: now,
        last_login: lastLogin,
        login_count: Math.floor(Math.random() * 20) + 1,
        last_activity: lastLogin,
        kelas_id: Math.floor((i-7) / 4) + 1
      });
    }
    
    
    kelas.push(
      { id: 1, nama: "Kelas 1A", tingkat: "1", wali_kelas_id: 2, created_at: now },
      { id: 2, nama: "Kelas 2B", tingkat: "2", wali_kelas_id: 3, created_at: now },
      { id: 3, nama: "Kelas 3C", tingkat: "3", wali_kelas_id: 4, created_at: now }
    );
    
    
    for (let i = 1; i <= 10; i++) {
      materi.push({
        id: i,
        judul: `Materi Pembelajaran ${i}`,
        deskripsi: `Deskripsi materi pembelajaran ${i}`,
        konten: `Konten lengkap materi pembelajaran ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
        guru_id: Math.floor(Math.random() * 5) + 2,
        kelas_id: Math.floor(Math.random() * 3) + 1,
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      });
    }
    
    
    guruKelas.push(
      { id: 1, guru_id: 2, kelas_id: 1, mata_pelajaran: "Matematika" },
      { id: 2, guru_id: 3, kelas_id: 2, mata_pelajaran: "Bahasa Indonesia" },
      { id: 3, guru_id: 4, kelas_id: 3, mata_pelajaran: "IPA" },
      { id: 4, guru_id: 5, kelas_id: 1, mata_pelajaran: "IPS" },
      { id: 5, guru_id: 6, kelas_id: 2, mata_pelajaran: "Olahraga" }
    );
    
    
    for (let i = 1; i <= 5; i++) {
      tugas.push({
        id: i,
        judul: `Tugas ${i}`,
        deskripsi: `Deskripsi tugas ${i}. Silakan kerjakan dengan baik dan benar.`,
        materi_id: Math.floor(Math.random() * 10) + 1,
        guru_id: Math.floor(Math.random() * 5) + 2,
        deadline: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    
    for (let i = 1; i <= 5; i++) {
      for (let j = 7; j <= 12; j++) {
        const statuses: Array<'belum_dikerjakan' | 'dikerjakan' | 'selesai'> = 
          ['belum_dikerjakan', 'dikerjakan', 'selesai'];
        const status = statuses[Math.floor(Math.random() * 3)];
        
        siswaTugas.push({
          id: siswaTugas.length + 1,
          siswa_id: j,
          tugas_id: i,
          status: status,
          nilai: status === 'selesai' ? Math.floor(Math.random() * 100) + 1 : undefined,
          jawaban: status !== 'belum_dikerjakan' ? `Jawaban tugas ${i} dari siswa ${j}` : undefined,
          feedback: status === 'selesai' ? 'Kerja bagus!' : undefined,
          submitted_at: status !== 'belum_dikerjakan' ? new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) : undefined,
          graded_at: status === 'selesai' ? new Date(Date.now() - (i * 12 * 60 * 60 * 1000)) : undefined
        });
      }
    }
    
    
    for (let i = 7; i <= 19; i++) {
      for (let j = 1; j <= 5; j++) {
        siswaMateri.push({
          id: siswaMateri.length + 1,
          siswa_id: i,
          materi_id: j,
          last_accessed: new Date(Date.now() - j * 24 * 60 * 60 * 1000),
          is_completed: Math.random() > 0.5
        });
      }
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
    
    console.log("Database seeded successfully!");
    console.log(`Users: ${users.length}, Materi: ${materi.length}, Tugas: ${tugas.length}`);
    console.log(`SiswaTugas: ${siswaTugas.length}, SiswaMateri: ${siswaMateri.length}`);
  }
}

await seed();