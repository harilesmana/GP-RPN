import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  users, kelas, materi, diskusi, tugas, submissions, diskusiMateri,
  User, Kelas, Materi, Diskusi, Tugas
} from "../db";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";

export const kepsekRoutes = new Elysia({ prefix: "/kepsek" })
  .derive(authMiddleware as any)

  .onBeforeHandle(({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.status = 403;
      return "Akses ditolak. Hanya kepala sekolah yang dapat mengakses endpoint ini.";
    }
  })

  // Dashboard info dasar
  .get("/info-dasar", () => {
    const jumlahGuru = users.filter(u => u.role === "guru").length;
    const jumlahSiswa = users.filter(u => u.role === "siswa").length;
    const jumlahKelas = kelas.length;
    const jumlahMateri = materi.length;

    return {
      jumlah_guru: jumlahGuru,
      jumlah_siswa: jumlahSiswa,
      jumlah_kelas: jumlahKelas,
      jumlah_materi: jumlahMateri
    };
  })

  // Daftar guru
  .get("/guru/daftar", () => {
    const daftarGuru = users
      .filter(u => u.role === "guru")
      .map(guru => ({
        id: guru.id,
        nama: guru.nama,
        email: guru.email,
        bidang: guru.bidang || "-",
        status: guru.status,
        last_login: guru.last_login,
        login_count: guru.login_count || 0,
        created_at: guru.created_at
      }));

    return daftarGuru;
  })

  // Tambah guru baru
  .post("/guru/tambah", async ({ body, set }) => {
    const parsed = addGuruSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Data tidak valid", details: parsed.error.issues };
    }

    const { nama, email, password } = parsed.data;
    const bidang = (body as any).bidang || "";

    // Cek email sudah ada
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      set.status = 400;
      return { error: "Email sudah terdaftar" };
    }

    try {
      const passwordHash = await hashPassword(password);
      const now = new Date();

      const newGuru: User = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: "guru",
        status: "active",
        created_by: 1, // Kepala sekolah
        created_at: now,
        last_login: undefined,
        login_count: 0,
        last_activity: undefined,
        bidang: bidang.trim() || undefined
      };

      users.push(newGuru);

      return {
        success: true,
        message: "Guru berhasil ditambahkan",
        data: {
          id: newGuru.id,
          nama: newGuru.nama,
          email: newGuru.email,
          bidang: newGuru.bidang
        }
      };
    } catch (error) {
      console.error("Error adding guru:", error);
      set.status = 500;
      return { error: "Terjadi kesalahan server" };
    }
  })

  // Update status guru
  .patch("/guru/status/:id", async ({ params, body, set }) => {
    const parsed = updateUserStatusSchema.safeParse({
      id: params.id,
      ...body
    });

    if (!parsed.success) {
      set.status = 400;
      return { error: "Data tidak valid", details: parsed.error.issues };
    }

    const { id, status } = parsed.data;
    const guru = users.find(u => u.id === id && u.role === "guru");

    if (!guru) {
      set.status = 404;
      return { error: "Guru tidak ditemukan" };
    }

    guru.status = status;
    return { success: true, message: `Status guru berhasil diubah menjadi ${status}` };
  })

  // Hapus guru
  .delete("/guru/hapus/:id", async ({ params, set }) => {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      set.status = 400;
      return { error: "ID tidak valid" };
    }

    const index = users.findIndex(u => u.id === id && u.role === "guru");
    if (index === -1) {
      set.status = 404;
      return { error: "Guru tidak ditemukan" };
    }

    // Hapus guru dari array
    users.splice(index, 1);
    return { success: true, message: "Guru berhasil dihapus" };
  })

  // Daftar siswa
  .get("/siswa/daftar", () => {
    const daftarSiswa = users
      .filter(u => u.role === "siswa")
      .map(siswa => {
        const kelasSiswa = kelas.find(k => k.id === siswa.kelas_id);

        return {
          id: siswa.id,
          nama: siswa.nama,
          email: siswa.email,
          kelas: kelasSiswa?.nama || "Belum ditentukan",
          kelas_id: siswa.kelas_id,
          status: siswa.status,
          last_login: siswa.last_login,
          login_count: siswa.login_count || 0
        };
      });

    return daftarSiswa;
  })

  // Detail tugas siswa
  .get("/siswa/tugas/:id", async ({ params, set }) => {
    const siswaId = parseInt(params.id);
    if (isNaN(siswaId)) {
      set.status = 400;
      return { error: "ID siswa tidak valid" };
    }

    const siswa = users.find(u => u.id === siswaId && u.role === "siswa");
    if (!siswa) {
      set.status = 404;
      return { error: "Siswa tidak ditemukan" };
    }

    // Cari tugas berdasarkan kelas siswa
    const kelasSiswa = siswa.kelas_id || 1;
    const tugasSiswa = tugas
      .filter(t => {
        const materiTugas = materi.find(m => m.id === t.materi_id);
        return materiTugas && materiTugas.kelas_id === kelasSiswa;
      })
      .map(t => {
        const submission = submissions.find(s => s.tugas_id === t.id && s.siswa_id === siswaId);
        const materiItem = materi.find(m => m.id === t.materi_id);

        return {
          id: t.id,
          judul: t.judul,
          materi: materiItem?.judul || "Materi tidak ditemukan",
          status: submission ? "dikerjakan" : "belum_dikerjakan",
          nilai: submission?.nilai,
          feedback: submission?.feedback,
          deadline: t.deadline,
          submitted_at: submission?.submitted_at,
          graded_at: submission?.graded_at
        };
      });

    return tugasSiswa;
  })

  // Daftar materi
  .get("/materi/daftar", () => {
    const daftarMateri = materi.map(m => {
      const guruPengampu = users.find(u => u.id === m.guru_id);
      const kelasMateri = kelas.find(k => k.id === m.kelas_id);

      return {
        id: m.id,
        judul: m.judul,
        deskripsi: m.deskripsi,
        guru: guruPengampu?.nama || "Tidak diketahui",
        guru_bidang: guruPengampu?.bidang || "-",
        kelas: kelasMateri?.nama || "Tidak diketahui",
        created_at: m.created_at,
        updated_at: m.updated_at
      };
    });

    return daftarMateri;
  })

  // Diskusi materi untuk materi tertentu
  .get("/kelas/diskusi-materi/:id", async ({ params, set }) => {
    const materiId = parseInt(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const materiItem = materi.find(m => m.id === materiId);
    if (!materiItem) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    const diskusiMateriList = diskusiMateri
      .filter(d => d.materi_id === materiId)
      .map(d => {
        const user = users.find(u => u.id === d.user_id);
        return {
          id: d.id,
          user: user?.nama || "Anonim",
          role: d.user_role,
          isi: d.isi,
          created_at: d.created_at,
          parent_id: d.parent_id
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return diskusiMateriList
  })

  // Daftar semua diskusi kelas
  .get("/kelas/diskusi", () => {
    const daftarDiskusi = diskusi.map(d => {
      const user = users.find(u => u.id === d.user_id);
      return {
        id: d.id,
        kelas: d.kelas,
        isi: d.isi.length > 100 ? d.isi.substring(0, 100) + "..." : d.isi,
        user: user?.nama || "Anonim",
        role: d.user_role,
        created_at: d.created_at
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return daftarDiskusi;
  })

  // Tambah diskusi kelas
  .post("/kelas/diskusi", async ({ body, user, set }) => {
    const { kelas, isi } = body as any;

    if (!kelas || !isi) {
      set.status = 400;
      return { error: "Kelas dan isi diskusi harus diisi" };
    }

    if (isi.length < 5) {
      set.status = 400;
      return { error: "Isi diskusi terlalu pendek (minimal 5 karakter)" };
    }

    const newDiskusi: Diskusi = {
      id: Math.max(...diskusi.map(d => d.id), 0) + 1,
      kelas: kelas.trim(),
      isi: isi.trim(),
      user_id: user.userId,
      user_role: user.role,
      created_at: new Date()
    };

    diskusi.push(newDiskusi);

    return {
      success: true,
      message: "Diskusi berhasil ditambahkan",
      data: {
        id: newDiskusi.id,
        kelas: newDiskusi.kelas,
        isi: newDiskusi.isi
      }
    };
  })

  // Statistik tugas dan nilai
  .get("/statistik/tugas-nilai", () => {
    const totalTugas = tugas.length;
    const totalSubmissions = submissions.length;
    const submissionsWithGrades = submissions.filter(s => s.nilai !== undefined).length;

    const nilaiList = submissions
      .filter(s => s.nilai !== undefined)
      .map(s => s.nilai as number);

    const rataNilai = nilaiList.length > 0
      ? Math.round(nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length)
      : 0;

    return {
      total_tugas: totalTugas,
      total_submissions: totalSubmissions,
      submissions_graded: submissionsWithGrades,
      rata_nilai_keseluruhan: rataNilai,
      participation_rate: totalTugas > 0 ? Math.round((totalSubmissions / (totalTugas * users.filter(u => u.role === "siswa").length)) * 100) : 0
    };
  });