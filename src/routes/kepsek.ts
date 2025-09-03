import { Elysia } from "elysia";
import { users, guruInfoList, tugasList, materiList } from "../db";
import { authMiddleware } from "./auth";


export interface DiskusiKelas {
  id: number;
  kelas: string;
  user_id: number;
  isi: string;
  created_at: Date;
}

export interface DiskusiMateri {
  id: number;
  materi_id: number;
  user_id: number;
  isi: string;
  created_at: Date;
}


export const diskusiKelas: DiskusiKelas[] = [];
export const diskusiMateri: DiskusiMateri[] = [];


const countByRole = (role: "guru" | "siswa") =>
  users.filter(u => u.role === role).length;

export const kepsekRoutes = new Elysia()
  .derive(authMiddleware as any)

  /** ================= INFO DASAR ================= **/
  .get("/info-dasar", ({ user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    
    return {
      jumlah_siswa: countByRole("siswa"),
      jumlah_guru: countByRole("guru"),
      jumlah_kelas: 10 
    };
  })

  /** ================= MANAGEMENT GURU ================= **/
  .post("/guru/tambah", async ({ body, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const { nama, email, password, bidang } = body as any;

    const id = users.length + 1;
    const now = new Date();
    const password_hash = await import("../utils/hash").then(m => m.hashPassword(password));

    users.push({
      id,
      nama,
      email,
      password_hash,
      role: "guru",
      status: "active",
      created_by: user.id,
      created_at: now
    });

    guruInfoList.push({ user_id: id, bidang });

    return { success: true, guru_id: id };
  })
  .delete("/guru/hapus/:id", ({ params, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const guruId = parseInt(params.id);

    const index = users.findIndex(u => u.id === guruId && u.role === "guru");
    if (index === -1) return { error: "Guru tidak ditemukan" };

    users.splice(index, 1);
    const infoIndex = guruInfoList.findIndex(g => g.user_id === guruId);
    if (infoIndex !== -1) guruInfoList.splice(infoIndex, 1);

    return { success: true };
  })
  .get("/guru/daftar", ({ user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    return users
      .filter(u => u.role === "guru")
      .map(g => ({
        id: g.id,
        nama: g.nama,
        email: g.email,
        status: g.status,
        bidang: guruInfoList.find(info => info.user_id === g.id)?.bidang
      }));
  })
  .patch("/guru/status/:id", ({ params, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const guruId = parseInt(params.id);
    const guru = users.find(u => u.id === guruId && u.role === "guru");
    if (!guru) return { error: "Guru tidak ditemukan" };

    guru.status = guru.status === "active" ? "inactive" : "active";
    return { success: true, status: guru.status };
  })

  /** ================= MANAGEMENT SISWA ================= **/
  .get("/siswa/daftar", ({ user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    return users
      .filter(u => u.role === "siswa")
      .map(s => ({
        id: s.id,
        nama: s.nama,
        email: s.email,
        kelas: "Kelas 1" 
      }));
  })
  .get("/siswa/tugas/:id", ({ params, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const siswaId = parseInt(params.id);

    const tugasSiswa = tugasList.filter(t => t.siswa_id === siswaId)
      .map(t => ({
        materi_id: t.materi_id,
        materi: materiList.find(m => m.id === t.materi_id)?.judul,
        status: t.status,
        nilai: t.nilai ?? null,
        hasil_akhir: t.hasil_akhir ?? null
      }));

    return tugasSiswa;
  })

  /** ================= MANAGE TUGAS/MATERI ================= **/
  .get("/materi/daftar", ({ user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    return materiList.map(m => ({
      id: m.id,
      judul: m.judul,
      guru: users.find(u => u.id === m.guru_id)?.nama
    }));
  })

  /** ================= MANAGEMENT KELAS ================= **/
  
  .get("/kelas/diskusi", ({ user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    return diskusiKelas;
  })
  .post("/kelas/diskusi", ({ body, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const { kelas, isi } = body as any;
    const id = diskusiKelas.length + 1;
    diskusiKelas.push({ id, kelas, isi, user_id: user.id, created_at: new Date() });
    return { success: true, id };
  })

  
  .get("/kelas/diskusi-materi/:materi_id", ({ params, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const materiId = parseInt(params.materi_id);
    return diskusiMateri.filter(d => d.materi_id === materiId);
  })
  .post("/kelas/diskusi-materi", ({ body, user }) => {
    if (user.role !== "kepsek") return { error: "Akses ditolak" };
    const { materi_id, isi } = body as any;
    const id = diskusiMateri.length + 1;
    diskusiMateri.push({ id, materi_id, isi, user_id: user.id, created_at: new Date() });
    return { success: true, id };
  });
