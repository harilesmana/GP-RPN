import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";
import { users, kelas, materi, diskusi, Role } from "../db";

export const kepsekRoutes = new Elysia()
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user || user.role !== "kepsek") {
      throw new Error("Unauthorized");
    }
    return { user };
  })
  
  .get("/kepsek/info-dasar", () => {
    const jumlah_guru = users.filter(u => u.role === "guru").length;
    const jumlah_siswa = users.filter(u => u.role === "siswa").length;
    const jumlah_kelas = kelas.length;
    const jumlah_materi = materi.length;

    return {
      jumlah_guru,
      jumlah_siswa,
      jumlah_kelas,
      jumlah_materi
    };
  })
  
  .get("/kepsek/guru/daftar", () => {
    return users
      .filter(u => u.role === "guru")
      .map(guru => ({
        id: guru.id,
        nama: guru.nama,
        email: guru.email,
        bidang: guru.bidang,
        status: guru.status,
        created_at: guru.created_at
      }));
  })
  .post("/kepsek/guru/tambah", async ({ body }) => {
    const validatedData = addGuruSchema.parse(body);

    
    if (users.some(u => u.email === validatedData.email)) {
      throw new Error("Email sudah terdaftar");
    }

    const hashedPassword = await hashPassword(validatedData.password);
    const newGuru = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      nama: validatedData.nama,
      email: validatedData.email,
      password_hash: hashedPassword,
      role: "guru" as Role,
      status: "active" as const,
      bidang: validatedData.nama, 
      created_at: new Date(),
      last_login: undefined,
      login_count: 0,
      last_activity: new Date()
    };

    users.push(newGuru);
    return { message: "Guru berhasil ditambahkan", id: newGuru.id };
  })
  .patch("/kepsek/guru/status/:id", async ({ params, body }) => {
    const { id } = params;
    const validatedData = updateUserStatusSchema.parse(body);

    const user = users.find(u => u.id === parseInt(id) && u.role === "guru");
    if (!user) {
      throw new Error("Guru tidak ditemukan");
    }

    user.status = validatedData.status;
    return { message: "Status guru berhasil diupdate" };
  })
  .delete("/kepsek/guru/hapus/:id", async ({ params }) => {
    const { id } = params;
    const index = users.findIndex(u => u.id === parseInt(id) && u.role === "guru");
    
    if (index === -1) {
      throw new Error("Guru tidak ditemukan");
    }

    users.splice(index, 1);
    return { message: "Guru berhasil dihapus" };
  })
  
  .get("/kepsek/siswa/daftar", () => {
    return users
      .filter(u => u.role === "siswa")
      .map(siswa => ({
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        status: siswa.status,
        created_at: siswa.created_at
      }));
  })
  .get("/kepsek/siswa/tugas/:id", async ({ params }) => {
    const { id } = params;
    const { tugas } = await import("../db");
    
    return tugas.filter(t => t.siswa_id === parseInt(id));
  })
  
  .get("/kepsek/materi/daftar", () => {
    return materi.map(m => ({
      id: m.id,
      judul: m.judul,
      guru: users.find(u => u.id === m.guru_id)?.nama || "Unknown",
      created_at: m.created_at
    }));
  })
  
  .get("/kepsek/kelas/diskusi", () => {
    return diskusi;
  })
  .post("/kepsek/kelas/diskusi", async ({ body, user }) => {
    const { kelas: kelasName, isi } = body as any;

    const newDiskusi = {
      id: diskusi.length > 0 ? Math.max(...diskusi.map(d => d.id)) + 1 : 1,
      kelas: kelasName,
      isi,
      user_id: user!.userId,
      user_role: user!.role as Role,
      created_at: new Date()
    };

    diskusi.push(newDiskusi);
    return { message: "Diskusi berhasil ditambahkan", id: newDiskusi.id };
  })
  .get("/kepsek/kelas/diskusi-materi/:id", async ({ params }) => {
    const { id } = params;
    const { diskusiMateri } = await import("../db");
    
    return diskusiMateri
      .filter(d => d.materi_id === parseInt(id))
      .map(d => ({
        id: d.id,
        user: users.find(u => u.id === d.user_id)?.nama || "Unknown",
        role: d.user_role,
        isi: d.isi,
        created_at: d.created_at
      }));
  });