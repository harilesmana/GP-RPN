import { Elysia } from "elysia";
import ejs from "ejs";
import { authMiddleware } from "../middleware/auth";
import { 
  users, classes, mataPelajaran, guruMengajar, tasks, 
  tugasSiswa, diskusi, User
} from "../db";
import { hashPassword } from "../utils/hash";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";

const render = async (file: string, data: Record<string, any> = {}) => {
  const tpl = await Bun.file(file).text();
  return ejs.render(tpl, data);
};

export const kepsekRoutes = new Elysia({ prefix: "/kepsek" })
  .derive(authMiddleware as any)
  .onBeforeHandle(({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.status = 302;
      set.headers.Location = "/dashboard";
      return "Unauthorized";
    }
  })
  
  .get("/guru", async ({ set, user }) => {
    const daftarGuru = users.filter(u => u.role === "guru");
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/guru.ejs", { 
      user, 
      daftarGuru 
    });
  })
  
  .get("/guru/tambah", async ({ set, user }) => {
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/tambah-guru.ejs", { 
      user, 
      error: "", 
      values: {} 
    });
  })
  
  .post("/guru/tambah", async ({ set, user, parseFormData }) => {
    try {
      const body = await parseFormData();
      const parsed = addGuruSchema.safeParse(body);
      
      if (!parsed.success) {
        set.headers["Content-Type"] = "text/html; charset=utf-8";
        return render("views/kepsek/tambah-guru.ejs", { 
          user, 
          error: parsed.error.issues.map(i => i.message).join(", "),
          values: body
        });
      }
      
      const { nama, email, password } = parsed.data;
      
      
      if (users.some(u => u.email === email)) {
        set.headers["Content-Type"] = "text/html; charset=utf-8";
        return render("views/kepsek/tambah-guru.ejs", { 
          user, 
          error: "Email sudah terdaftar",
          values: body
        });
      }
      
      
      const newGuru: User = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        nama,
        email,
        password_hash: await hashPassword(password),
        role: "guru",
        status: "active",
        created_by: user.userId,
        created_at: new Date(),
        last_login: new Date()
      };
      
      users.push(newGuru);
      
      set.status = 302;
      set.headers.Location = "/kepsek/guru?message=Guru berhasil ditambahkan";
    } catch (error) {
      set.headers["Content-Type"] = "text/html; charset=utf-8";
      return render("views/kepsek/tambah-guru.ejs", { 
        user, 
        error: "Terjadi kesalahan sistem",
        values: {}
      });
    }
  })
  .post("/guru/status", async ({ set, parseFormData }) => {
    const body = await parseFormData();
    const parsed = updateUserStatusSchema.safeParse(body);
    
    if (!parsed.success) {
      set.status = 400;
      return parsed.error.issues.map(i => i.message).join(", ");
    }
    
    const { id, status } = parsed.data;
    const guru = users.find(u => u.id === id && u.role === "guru");
    
    if (!guru) {
      set.status = 404;
      return "Guru tidak ditemukan";
    }
    
    guru.status = status;
    
    set.status = 302;
    set.headers.Location = "/kepsek/guru?message=Status guru berhasil diubah";
  })
  
  .get("/guru/pengajar", async ({ set, user }) => {
    const infoPengajar = guruMengajar.map(gm => {
      const guru = users.find(u => u.id === gm.guru_id);
      const mapel = mataPelajaran.find(m => m.id === gm.mata_pelajaran_id);
      const kelas = classes.find(c => c.id === gm.kelas_id);
      
      return {
        id: gm.id,
        guru: guru?.nama || "Unknown",
        mataPelajaran: mapel?.nama || "Unknown",
        kelas: kelas?.nama || "Unknown"
      };
    });
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/info-pengajar.ejs", { 
      user, 
      infoPengajar 
    });
  })

  .get("/siswa/tugas", async ({ set, user }) => {
    const daftarTugas = tasks.map(t => {
      const mapel = mataPelajaran.find(m => m.id === t.mata_pelajaran_id);
      const guru = users.find(u => u.id === t.created_by);
      const tugasSiswaData = tugasSiswa.filter(ts => ts.tugas_id === t.id);
      
      const selesai = tugasSiswaData.filter(ts => ts.status === 'selesai').length;
      const belum = tugasSiswaData.filter(ts => ts.status === 'belum').length;
      
      return {
        id: t.id,
        judul: t.judul,
        mataPelajaran: mapel?.nama || "Unknown",
        pembuat: guru?.nama || "Unknown",
        selesai,
        belum,
        total: selesai + belum
      };
    });
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/tugas-siswa.ejs", { 
      user, 
      daftarTugas 
    });
  })

  .get("/tugas", async ({ set, user }) => {
    const daftarTugas = tasks.map(t => {
      const mapel = mataPelajaran.find(m => m.id === t.mata_pelajaran_id);
      const guru = users.find(u => u.id === t.created_by);
      
      return {
        id: t.id,
        judul: t.judul,
        deskripsi: t.deskripsi,
        mataPelajaran: mapel?.nama || "Unknown",
        pembuat: guru?.nama || "Unknown",
        deadline: t.deadline.toLocaleDateString('id-ID')
      };
    });
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/daftar-tugas.ejs", { 
      user, 
      daftarTugas 
    });
  })
  
  .get("/komunikasi/kelas", async ({ set, user }) => {
    const diskusiKelas = diskusi
      .filter(d => d.target_type === 'kelas')
      .map(d => {
        const pengirim = users.find(u => u.id === d.pengirim_id);
        const kelas = classes.find(c => c.id === d.target_id);
        
        return {
          id: d.id,
          topik: d.topik,
          pesan: d.pesan,
          pengirim: pengirim?.nama || "Unknown",
          kelas: kelas?.nama || "Unknown",
          waktu: d.created_at.toLocaleString('id-ID')
        };
      });
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/diskusi-kelas.ejs", { 
      user, 
      diskusiKelas 
    });
  })
  
  .get("/komunikasi/tugas", async ({ set, user }) => {
    const diskusiTugas = diskusi
      .filter(d => d.target_type === 'tugas')
      .map(d => {
        const pengirim = users.find(u => u.id === d.pengirim_id);
        const tugas = tasks.find(t => t.id === d.target_id);
        
        return {
          id: d.id,
          topik: d.topik,
          pesan: d.pesan,
          pengirim: pengirim?.nama || "Unknown",
          tugas: tugas?.judul || "Unknown",
          waktu: d.created_at.toLocaleString('id-ID')
        };
      });
    
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/kepsek/diskusi-tugas.ejs", { 
      user, 
      diskusiTugas 
    });
  });
