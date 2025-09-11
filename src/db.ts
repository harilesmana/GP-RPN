import mysql from 'mysql2/promise';
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

export interface MateriKelas {
  id: number;
  materi_id: number;
  kelas_id: number;
  created_at: Date;
}

export interface SiswaKelas {
  id: number;
  siswa_id: number;
  kelas_id: number;
  created_at: Date;
}


let pool: mysql.Pool;

export function initializeDatabase() {
  pool = mysql.createPool({
    host: 'sql12.freesqldatabase.com',
    user: 'sql12798097',
    password: 'xp8qEXlMNx',
    database: 'sql12798097',
    port: 3306,
    connectionLimit: 10,
    acquireTimeout: 60000,
    connectTimeout: 60000,
  });

  return pool;
}

export async function query(sql: string, params: any[] = []) {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}


export async function getUsers(): Promise<User[]> {
  const rows = await query('SELECT * FROM users');
  return rows as User[];
}

export async function getKelas(): Promise<Kelas[]> {
  const rows = await query('SELECT * FROM kelas');
  return rows as Kelas[];
}

export async function getMateri(): Promise<Materi[]> {
  const rows = await query('SELECT * FROM materi');
  return rows as Materi[];
}

export async function getDiskusi(): Promise<Diskusi[]> {
  const rows = await query('SELECT * FROM diskusi');
  return rows as Diskusi[];
}

export async function getTugas(): Promise<Tugas[]> {
  const rows = await query('SELECT * FROM tugas');
  return rows as Tugas[];
}

export async function getDiskusiMateri(): Promise<DiskusiMateri[]> {
  const rows = await query('SELECT * FROM diskusi_materi');
  return rows as DiskusiMateri[];
}

export async function getSiswaTugas(): Promise<SiswaTugas[]> {
  const rows = await query('SELECT * FROM siswa_tugas');
  return rows as SiswaTugas[];
}

export async function getSiswaMateri(): Promise<SiswaMateri[]> {
  const rows = await query('SELECT * FROM siswa_materi');
  return rows as SiswaMateri[];
}

export async function getGuruKelas(): Promise<GuruKelas[]> {
  const rows = await query('SELECT * FROM guru_kelas');
  return rows as GuruKelas[];
}

export async function getMateriKelas(): Promise<MateriKelas[]> {
  const rows = await query('SELECT * FROM materi_kelas');
  return rows as MateriKelas[];
}

export async function getSiswaKelas(): Promise<SiswaKelas[]> {
  const rows = await query('SELECT * FROM siswa_kelas');
  return rows as SiswaKelas[];
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  return (rows as User[])[0] || null;
}

export async function getKelasById(id: number): Promise<Kelas | null> {
  const rows = await query('SELECT * FROM kelas WHERE id = ?', [id]);
  return (rows as Kelas[])[0] || null;
}

export async function getMateriById(id: number): Promise<Materi | null> {
  const rows = await query('SELECT * FROM materi WHERE id = ?', [id]);
  return (rows as Materi[])[0] || null;
}


export async function getKelasForMateri(materiId: number): Promise<Kelas[]> {
  const rows = await query(`
    SELECT k.* FROM kelas k
    JOIN materi_kelas mk ON k.id = mk.kelas_id
    WHERE mk.materi_id = ?
  `, [materiId]);
  
  return rows as Kelas[];
}

export async function getMateriForKelas(kelasId: number): Promise<Materi[]> {
  const rows = await query(`
    SELECT m.* FROM materi m
    JOIN materi_kelas mk ON m.id = mk.materi_id
    WHERE mk.kelas_id = ?
  `, [kelasId]);
  
  return rows as Materi[];
}

export async function getKelasForSiswa(siswaId: number): Promise<Kelas[]> {
  const rows = await query(`
    SELECT k.* FROM kelas k
    JOIN siswa_kelas sk ON k.id = sk.kelas_id
    WHERE sk.siswa_id = ?
  `, [siswaId]);
  
  return rows as Kelas[];
}

export async function getSiswaForKelas(kelasId: number): Promise<User[]> {
  const rows = await query(`
    SELECT u.* FROM users u
    JOIN siswa_kelas sk ON u.id = sk.siswa_id
    WHERE sk.kelas_id = ? AND u.role = 'siswa'
  `, [kelasId]);
  
  return rows as User[];
}

export async function getTugasForKelas(kelasId: number): Promise<Tugas[]> {
  const materiIds = (await getMateriForKelas(kelasId)).map(m => m.id);
  
  if (materiIds.length === 0) return [];
  
  const placeholders = materiIds.map(() => '?').join(',');
  const rows = await query(`
    SELECT * FROM tugas 
    WHERE materi_id IN (${placeholders})
  `, materiIds);
  
  return rows as Tugas[];
}

export async function getTugasForSiswa(siswaId: number): Promise<Tugas[]> {
  const kelasSiswa = await getKelasForSiswa(siswaId);
  const semuaTugasPromises = kelasSiswa.map(k => getTugasForKelas(k.id));
  const semuaTugasArrays = await Promise.all(semuaTugasPromises);
  const semuaTugas = semuaTugasArrays.flat();
  
  
  const uniqueTugas = semuaTugas.filter((tugas, index, self) => 
    index === self.findIndex(t => t.id === tugas.id)
  );
  
  return uniqueTugas;
}

export async function getSubmissionForSiswa(siswaId: number, tugasId?: number): Promise<SiswaTugas | SiswaTugas[]> {
  if (tugasId) {
    const rows = await query(`
      SELECT * FROM siswa_tugas 
      WHERE siswa_id = ? AND tugas_id = ?
    `, [siswaId, tugasId]);
    
    return (rows as SiswaTugas[])[0] || null;
  } else {
    const rows = await query(`
      SELECT * FROM siswa_tugas 
      WHERE siswa_id = ?
    `, [siswaId]);
    
    return rows as SiswaTugas[];
  }
}

export async function getMateriProgressForSiswa(siswaId: number, materiId?: number): Promise<SiswaMateri | SiswaMateri[]> {
  if (materiId) {
    const rows = await query(`
      SELECT * FROM siswa_materi 
      WHERE siswa_id = ? AND materi_id = ?
    `, [siswaId, materiId]);
    
    return (rows as SiswaMateri[])[0] || null;
  } else {
    const rows = await query(`
      SELECT * FROM siswa_materi 
      WHERE siswa_id = ?
    `, [siswaId]);
    
    return rows as SiswaMateri[];
  }
}

export async function getTugasWithStatus(siswaId: number): Promise<any[]> {
  const semuaTugas = await getTugasForSiswa(siswaId);
  const result = [];
  
  for (const tugasItem of semuaTugas) {
    const submission = await getSubmissionForSiswa(siswaId, tugasItem.id) as SiswaTugas;
    const materiItem = await getMateriById(tugasItem.materi_id);
    const kelasMateri = await getKelasForMateri(tugasItem.materi_id);
    
    result.push({
      ...tugasItem,
      status: submission?.status || 'belum_dikerjakan',
      nilai: submission?.nilai,
      feedback: submission?.feedback,
      jawaban: submission?.jawaban,
      submitted_at: submission?.submitted_at,
      graded_at: submission?.graded_at,
      materi_judul: materiItem?.judul || "Tidak diketahui",
      kelas: kelasMateri.map(k => k.nama).join(", ")
    });
  }
  
  return result;
}

export async function isSiswaInKelas(siswaId: number, kelasId: number): Promise<boolean> {
  const rows = await query(`
    SELECT COUNT(*) as count FROM siswa_kelas 
    WHERE siswa_id = ? AND kelas_id = ?
  `, [siswaId, kelasId]);
  
  return (rows as any[])[0].count > 0;
}

export async function isMateriInKelas(materiId: number, kelasId: number): Promise<boolean> {
  const rows = await query(`
    SELECT COUNT(*) as count FROM materi_kelas 
    WHERE materi_id = ? AND kelas_id = ?
  `, [materiId, kelasId]);
  
  return (rows as any[])[0].count > 0;
}

export async function getGuruForKelas(kelasId: number): Promise<User[]> {
  const rows = await query(`
    SELECT u.* FROM users u
    JOIN guru_kelas gk ON u.id = gk.guru_id
    WHERE gk.kelas_id = ?
  `, [kelasId]);
  
  return rows as User[];
}

export async function getKelasForGuru(guruId: number): Promise<Kelas[]> {
  const rows = await query(`
    SELECT k.* FROM kelas k
    JOIN guru_kelas gk ON k.id = gk.kelas_id
    WHERE gk.guru_id = ?
  `, [guruId]);
  
  return rows as Kelas[];
}


export const loginAttempts = new Map<string, { count: number; unlockTime: number }>();


export async function initializeTables() {
  try {
    
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('kepsek', 'guru', 'siswa') NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        login_count INT DEFAULT 0,
        last_activity TIMESTAMP NULL,
        bidang VARCHAR(100),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        tingkat VARCHAR(10) NOT NULL,
        wali_kelas_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wali_kelas_id) REFERENCES users(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS materi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        konten TEXT NOT NULL,
        guru_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (guru_id) REFERENCES users(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS diskusi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kelas VARCHAR(100) NOT NULL,
        isi TEXT NOT NULL,
        user_id INT NOT NULL,
        user_role ENUM('kepsek', 'guru', 'siswa') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS tugas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        materi_id INT NOT NULL,
        guru_id INT NOT NULL,
        deadline TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (materi_id) REFERENCES materi(id),
        FOREIGN KEY (guru_id) REFERENCES users(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS diskusi_materi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        materi_id INT NOT NULL,
        user_id INT NOT NULL,
        user_role ENUM('kepsek', 'guru', 'siswa') NOT NULL,
        isi TEXT NOT NULL,
        parent_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (materi_id) REFERENCES materi(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (parent_id) REFERENCES diskusi_materi(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS siswa_tugas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswa_id INT NOT NULL,
        tugas_id INT NOT NULL,
        jawaban TEXT,
        nilai INT,
        feedback TEXT,
        status ENUM('belum_dikerjakan', 'dikerjakan', 'selesai') DEFAULT 'belum_dikerjakan',
        submitted_at TIMESTAMP NULL,
        graded_at TIMESTAMP NULL,
        FOREIGN KEY (siswa_id) REFERENCES users(id),
        FOREIGN KEY (tugas_id) REFERENCES tugas(id),
        UNIQUE KEY unique_siswa_tugas (siswa_id, tugas_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS siswa_materi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswa_id INT NOT NULL,
        materi_id INT NOT NULL,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_completed BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (siswa_id) REFERENCES users(id),
        FOREIGN KEY (materi_id) REFERENCES materi(id),
        UNIQUE KEY unique_siswa_materi (siswa_id, materi_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS guru_kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guru_id INT NOT NULL,
        kelas_id INT NOT NULL,
        mata_pelajaran VARCHAR(100) NOT NULL,
        FOREIGN KEY (guru_id) REFERENCES users(id),
        FOREIGN KEY (kelas_id) REFERENCES kelas(id),
        UNIQUE KEY unique_guru_kelas (guru_id, kelas_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS materi_kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        materi_id INT NOT NULL,
        kelas_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (materi_id) REFERENCES materi(id),
        FOREIGN KEY (kelas_id) REFERENCES kelas(id),
        UNIQUE KEY unique_materi_kelas (materi_id, kelas_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS siswa_kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswa_id INT NOT NULL,
        kelas_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (siswa_id) REFERENCES users(id),
        FOREIGN KEY (kelas_id) REFERENCES kelas(id),
        UNIQUE KEY unique_siswa_kelas (siswa_id, kelas_id)
      )
    `);

    console.log("Database tables initialized successfully!");
  } catch (error) {
    console.error("Error initializing database tables:", error);
    throw error;
  }
}

export async function seed() {
  try {
    
    const users = await getUsers();
    
    if (users.length === 0) {
      const now = new Date();
      
      
      await query(
        `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Dr. Prabowo, M.Pd",
          "kepsek@example.com",
          await hashPassword("123456"),
          "kepsek",
          "active",
          now,
          now,
          15,
          now
        ]
      );
      
      
      const guruData = [
        { nama: "Jokowi, S.Pd", email: "guru@example.com", bidang: "Matematika" },
        { nama: "Megawati, S.Pd", email: "guru2@example.com", bidang: "Bahasa Indonesia" },
        { nama: "SBY, S.Pd", email: "guru3@example.com", bidang: "IPA" },
        { nama: "Gus Dur, S.Pd", email: "guru4@example.com", bidang: "IPS" },
        { nama: "Wiranto, S.Pd", email: "guru5@example.com", bidang: "Olahraga" }
      ];
      
      for (const [index, guru] of guruData.entries()) {
        await query(
          `INSERT INTO users (nama, email, password_hash, role, status, created_by, created_at, last_login, login_count, last_activity, bidang) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            guru.nama,
            guru.email,
            await hashPassword("123456"),
            "guru",
            index === 4 ? "inactive" : "active",
            1,
            now,
            new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
            Math.floor(Math.random() * 20) + 1,
            new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
            guru.bidang
          ]
        );
      }
      
      
      for (let i = 1; i <= 13; i++) {
        const status = i === 13 ? "inactive" : "active";
        const lastLogin = new Date(Date.now() - (i % 3) * 24 * 60 * 60 * 1000);
        
        await query(
          `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `Siswa ${i}`,
            `siswa${i}@example.com`,
            await hashPassword("123456"),
            "siswa",
            status,
            now,
            lastLogin,
            Math.floor(Math.random() * 20) + 1,
            lastLogin
          ]
        );
      }
      
      
      await query(
        `INSERT INTO kelas (nama, tingkat, wali_kelas_id, created_at) 
         VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
        [
          "Kelas 1A", "1", 2, now,
          "Kelas 2B", "2", 3, now,
          "Kelas 3C", "3", 4, now
        ]
      );
      
      
      for (let i = 1; i <= 10; i++) {
        await query(
          `INSERT INTO materi (judul, deskripsi, konten, guru_id, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `Materi Pembelajaran ${i}`,
            `Deskripsi materi pembelajaran ${i}`,
            `Konten lengkap materi pembelajaran ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
            Math.floor(Math.random() * 5) + 2,
            new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          ]
        );
      }
      
      
      await query(
        `INSERT INTO guru_kelas (guru_id, kelas_id, mata_pelajaran) 
         VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
        [
          2, 1, "Matematika",
          3, 2, "Bahasa Indonesia",
          4, 3, "IPA",
          5, 1, "IPS",
          6, 2, "Olahraga",
          2, 3, "Matematika Lanjutan"
        ]
      );
      
      
      for (let i = 1; i <= 10; i++) {
        const jumlahKelas = Math.floor(Math.random() * 3) + 1;
        const kelasIds = Array.from({ length: jumlahKelas }, () => Math.floor(Math.random() * 3) + 1);
        const uniqueKelasIds = [...new Set(kelasIds)];
        
        for (const kelasId of uniqueKelasIds) {
          await query(
            `INSERT INTO materi_kelas (materi_id, kelas_id, created_at) 
             VALUES (?, ?, ?)`,
            [i, kelasId, new Date()]
          );
        }
      }
      
      
      for (let i = 7; i <= 19; i++) {
        const jumlahKelas = Math.floor(Math.random() * 2) + 1;
        const kelasIds = Array.from({ length: jumlahKelas }, () => Math.floor(Math.random() * 3) + 1);
        const uniqueKelasIds = [...new Set(kelasIds)];
        
        for (const kelasId of uniqueKelasIds) {
          await query(
            `INSERT INTO siswa_kelas (siswa_id, kelas_id, created_at) 
             VALUES (?, ?, ?)`,
            [i, kelasId, new Date()]
          );
        }
      }
      
      
      for (let i = 1; i <= 5; i++) {
        await query(
          `INSERT INTO tugas (judul, deskripsi, materi_id, guru_id, deadline, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `Tugas ${i}`,
            `Deskripsi tugas ${i}. Silakan kerjakan dengan baik dan benar.`,
            Math.floor(Math.random() * 10) + 1,
            Math.floor(Math.random() * 5) + 2,
            new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)),
            new Date(),
            new Date()
          ]
        );
      }
      
      
      for (let i = 1; i <= 5; i++) {
        for (let j = 7; j <= 12; j++) {
          const statuses: Array<'belum_dikerjakan' | 'dikerjakan' | 'selesai'> = 
            ['belum_dikerjakan', 'dikerjakan', 'selesai'];
          const status = statuses[Math.floor(Math.random() * 3)];
          const nilai = status === 'selesai' ? Math.floor(Math.random() * 100) + 1 : null;
          const jawaban = status !== 'belum_dikerjakan' ? `Jawaban tugas ${i} dari siswa ${j}` : null;
          const feedback = status === 'selesai' ? 'Kerja bagus!' : null;
          const submitted_at = status !== 'belum_dikerjakan' ? new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) : null;
          const graded_at = status === 'selesai' ? new Date(Date.now() - (i * 12 * 60 * 60 * 1000)) : null;
          
          await query(
            `INSERT INTO siswa_tugas (siswa_id, tugas_id, status, nilai, jawaban, feedback, submitted_at, graded_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [j, i, status, nilai, jawaban, feedback, submitted_at, graded_at]
          );
        }
      }
      
      
      for (let i = 7; i <= 19; i++) {
        for (let j = 1; j <= 5; j++) {
          await query(
            `INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) 
             VALUES (?, ?, ?, ?)`,
            [
              i,
              j,
              new Date(Date.now() - j * 24 * 60 * 60 * 1000),
              Math.random() > 0.5
            ]
          );
        }
      }
      
      
      for (let i = 1; i <= 15; i++) {
        const userRole = i % 3 === 0 ? "guru" : "siswa";
        const userId = userRole === "guru" ? 
                      Math.floor(Math.random() * 5) + 2 : 
                      Math.floor(Math.random() * 12) + 7;
        
        await query(
          `INSERT INTO diskusi (kelas, isi, user_id, user_role, created_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            `Kelas ${Math.floor(Math.random() * 3) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
            `Isi diskusi contoh ${i} untuk kelas`,
            userId,
            userRole,
            new Date(Date.now() - i * 2 * 60 * 60 * 1000)
          ]
        );
      }
      
      
      for (let i = 1; i <= 15; i++) {
        const userRole = i % 3 === 0 ? "guru" : "siswa";
        const userId = userRole === "guru" ? 
                      Math.floor(Math.random() * 4) + 2 : 
                      Math.floor(Math.random() * 12) + 7;
        
        await query(
          `INSERT INTO diskusi_materi (materi_id, user_id, user_role, isi, parent_id, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            Math.floor(Math.random() * 10) + 1,
            userId,
            userRole,
            `Pertanyaan atau komentar tentang materi ${i}`,
            i > 5 ? Math.floor(Math.random() * 5) + 1 : null,
            new Date(Date.now() - (i * 2 * 60 * 60 * 1000))
          ]
        );
      }
      
      console.log("Database seeded successfully!");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}


initializeDatabase();
initializeTables();
seed();