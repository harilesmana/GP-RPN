import { Elysia } from "elysia";
import ejs from "ejs";
import { authMiddleware } from "../middleware/auth";
import {
  users,
  classes,
  mataPelajaran,
  guruMengajar,
  tasks,
  tugasSiswa,
  diskusi,
  siswaKelas,
  type Tugas,
  type Diskusi,
  type TugasSiswa
} from "../db";

const render = async (file: string, data: Record<string, any> = {}) => {
  const tpl = await Bun.file(file).text();
  return ejs.render(tpl, data);
};

export const guruRoutes = new Elysia()
  .derive(authMiddleware as any)
  
  
  .get("/guru/dashboard", async ({ set, user }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    
    const guru = users.find(u => u.id === user.userId);
    
    
    const kelasDiampu = classes.filter(c => c.wali_kelas_id === user.userId);
    
    
    const mapelDiajar = guruMengajar
      .filter(gm => gm.guru_id === user.userId)
      .map(gm => {
        const mapel = mataPelajaran.find(mp => mp.id === gm.mata_pelajaran_id);
        const kelas = classes.find(c => c.id === gm.kelas_id);
        return { ...gm, nama_mapel: mapel?.nama, nama_kelas: kelas?.nama };
      });


    const tugasDibuat = tasks.filter(t => t.created_by === user.userId);
    
  
    const tugasPerluDinilai = tugasDibuat.map(tugas => {
      const submissions = tugasSiswa.filter(ts => ts.tugas_id === tugas.id);
      const sudahDinilai = submissions.filter(ts => ts.status === 'selesai' && ts.nilai !== undefined).length;
      const belumDinilai = submissions.filter(ts => ts.status === 'selesai' && ts.nilai === undefined).length;
      
      return {
        ...tugas,
        total_siswa: submissions.length,
        sudah_dinilai: sudahDinilai,
        perlu_dinilai: belumDinilai
      };
    });

    const totalPerluDinilai = tugasPerluDinilai.reduce((sum, t) => sum + t.perlu_dinilai, 0);


    const diskusiTerbaru = diskusi
      .filter(d => {
        const isKelas = d.target_type === 'kelas' && kelasDiampu.some(k => k.id === d.target_id);
        const isTugas = d.target_type === 'tugas' && tugasDibuat.some(t => t.id === d.target_id);
        return isKelas || isTugas;
      })
      .slice(0, 5)
      .map(d => {
        const pengirim = users.find(u => u.id === d.pengirim_id);
        return {
          ...d,
          nama_pengirim: pengirim?.nama || 'Unknown'
        };
      });

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/dashboard.ejs", {
      user: { ...user, nama: guru?.nama },
      kelasDiampu,
      mapelDiajar,
      tugasPerluDinilai,
      totalPerluDinilai,
      diskusiTerbaru
    });
  })
  

  .get("/guru/tugas", async ({ set, user }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const tugasDibuat = tasks.filter(t => t.created_by === user.userId);

    const tugasDenganStatus = tugasDibuat.map(tugas => {
      const submissions = tugasSiswa.filter(ts => ts.tugas_id === tugas.id);
      const sudahDikumpulkan = submissions.filter(ts => ts.status === 'selesai').length;
      const belumDikumpulkan = submissions.filter(ts => ts.status === 'belum').length;
      const totalSiswa = siswaKelas.filter(sk => sk.kelas_id === tugas.kelas_id).length;

      return {
        ...tugas,
        sudah_dikumpulkan: sudahDikumpulkan,
        belum_dikumpulkan: belumDikumpulkan,
        total_siswa: totalSiswa,
        mapel: mataPelajaran.find(mp => mp.id === tugas.mata_pelajaran_id)?.nama,
        kelas: classes.find(c => c.id === tugas.kelas_id)?.nama
      };
    });

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/tugas.ejs", {
      user,
      tasks: tugasDenganStatus
    });
  })


  .get("/guru/tugas/:id", async ({ set, user, params }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const tugasId = parseInt(params.id);
    const tugas = tasks.find(t => t.id === tugasId && t.created_by === user.userId);

    if (!tugas) {
      set.status = 404;
      return "Tugas tidak ditemukan";
    }

    const siswaDalamKelas = siswaKelas
      .filter(sk => sk.kelas_id === tugas.kelas_id)
      .map(sk => {
        const siswa = users.find(u => u.id === sk.siswa_id);
        const tugasSiswaData = tugasSiswa.find(ts => ts.tugas_id === tugasId && ts.siswa_id === sk.siswa_id);
        
        return {
          id: sk.siswa_id,
          nama: siswa?.nama || 'Siswa Tidak Dikenal',
          status: tugasSiswaData?.status || 'belum',
          nilai: tugasSiswaData?.nilai,
          dikumpulkan_pada: tugasSiswaData?.dikumpulkan_pada
        };
      });

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/detail-tugas.ejs", {
      user,
      tugas: {
        ...tugas,
        mapel: mataPelajaran.find(mp => mp.id === tugas.mata_pelajaran_id)?.nama,
        kelas: classes.find(c => c.id === tugas.kelas_id)?.nama
      },
      siswa: siswaDalamKelas
    });
  })


  .get("/guru/tugas/tambah", async ({ set, user }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const mapelDiajar = guruMengajar
      .filter(gm => gm.guru_id === user.userId)
      .map(gm => {
        const mapel = mataPelajaran.find(mp => mp.id === gm.mata_pelajaran_id);
        const kelas = classes.find(c => c.id === gm.kelas_id);
        return { 
          id: gm.mata_pelajaran_id, 
          nama: mapel?.nama,
          kelas_id: gm.kelas_id,
          kelas_nama: kelas?.nama
        };
      });

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/tambah-tugas.ejs", {
      user,
      mapelList: mapelDiajar
    });
  })

  
  .post("/guru/tugas/tambah", async ({ set, user, request }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const formData = await request.formData();
    const judul = formData.get("judul") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const mata_pelajaran_id = parseInt(formData.get("mata_pelajaran_id") as string);
    const kelas_id = parseInt(formData.get("kelas_id") as string);
    const deadline = new Date(formData.get("deadline") as string);

    if (!judul || !mata_pelajaran_id || !kelas_id || !deadline) {
      set.status = 400;
      return "Data tidak lengkap";
    }

    const newTask: Tugas = {
      id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
      judul,
      deskripsi: deskripsi || "",
      mata_pelajaran_id,
      kelas_id,
      created_by: user.userId,
      deadline,
      created_at: new Date()
    };

    tasks.push(newTask);

    
    const siswaDiKelas = siswaKelas.filter(sk => sk.kelas_id === kelas_id);
    siswaDiKelas.forEach(siswa => {
      const newTugasSiswa: TugasSiswa = {
        id: tugasSiswa.length > 0 ? Math.max(...tugasSiswa.map(ts => ts.id)) + 1 : 1,
        tugas_id: newTask.id,
        siswa_id: siswa.siswa_id,
        status: 'belum',
        created_at: new Date()
      };
      tugasSiswa.push(newTugasSiswa);
    });

    set.status = 302;
    set.headers.Location = "/guru/tugas?message=Tugas berhasil ditambahkan";
    return;
  })

  
  .get("/guru/tugas/:id/nilai/:siswaId", async ({ set, user, params }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const tugasId = parseInt(params.id);
    const siswaId = parseInt(params.siswaId);
    
    const tugas = tasks.find(t => t.id === tugasId && t.created_by === user.userId);
    if (!tugas) {
      set.status = 404;
      return "Tugas tidak ditemukan";
    }

    const siswa = users.find(u => u.id === siswaId && u.role === 'siswa');
    if (!siswa) {
      set.status = 404;
      return "Siswa tidak ditemukan";
    }

    const tugasSiswaData = tugasSiswa.find(ts => 
      ts.tugas_id === tugasId && ts.siswa_id === siswaId
    );

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/beri-nilai.ejs", {
      user,
      tugas: {
        ...tugas,
        mapel: mataPelajaran.find(mp => mp.id === tugas.mata_pelajaran_id)?.nama
      },
      siswa,
      tugasSiswa: tugasSiswaData
    });
  })

  
  .post("/guru/tugas/:id/nilai/:siswaId", async ({ set, user, params, request }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const tugasId = parseInt(params.id);
    const siswaId = parseInt(params.siswaId);
    
    const formData = await request.formData();
    const nilai = parseInt(formData.get("nilai") as string);

    if (isNaN(nilai) || nilai < 0 || nilai > 100) {
      set.status = 400;
      return "Nilai tidak valid";
    }

    const tugasSiswaIndex = tugasSiswa.findIndex(ts => 
      ts.tugas_id === tugasId && ts.siswa_id === siswaId
    );

    if (tugasSiswaIndex === -1) {
      set.status = 404;
      return "Data tugas siswa tidak ditemukan";
    }

    tugasSiswa[tugasSiswaIndex].nilai = nilai;
    tugasSiswa[tugasSiswaIndex].status = 'selesai';
    if (!tugasSiswa[tugasSiswaIndex].dikumpulkan_pada) {
      tugasSiswa[tugasSiswaIndex].dikumpulkan_pada = new Date();
    }

    set.status = 302;
    set.headers.Location = `/guru/tugas/${tugasId}?message=Nilai berhasil disimpan`;
    return;
  })


  .get("/guru/diskusi", async ({ set, user }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const kelasDiampu = classes.filter(c => c.wali_kelas_id === user.userId);
    const tugasDibuat = tasks.filter(t => t.created_by === user.userId);

    const diskusiRelevan = diskusi.filter(d =>
      (d.target_type === 'kelas' && kelasDiampu.some(k => k.id === d.target_id)) ||
      (d.target_type === 'tugas' && tugasDibuat.some(t => t.id === d.target_id))
    );

    const diskusiDenganPengirim = diskusiRelevan.map(d => {
      const pengirim = users.find(u => u.id === d.pengirim_id);
      let targetName = '';

      if (d.target_type === 'kelas') {
        const kelas = classes.find(c => c.id === d.target_id);
        targetName = kelas?.nama || 'Kelas Tidak Dikenal';
      } else {
        const tugas = tasks.find(t => t.id === d.target_id);
        targetName = tugas?.judul || 'Tugas Tidak Dikenal';
      }

      return {
        ...d,
        nama_pengirim: pengirim?.nama || 'Pengirim Tidak Dikenal',
        target_name: targetName
      };
    });

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/diskusi.ejs", {
      user,
      diskusi: diskusiDenganPengirim,
      kelasList: kelasDiampu,
      tugasList: tugasDibuat
    });
  })

  
  .post("/guru/diskusi/tambah", async ({ set, user, request }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const formData = await request.formData();
    const topik = formData.get("topik") as string;
    const pesan = formData.get("pesan") as string;
    const target_type = formData.get("target_type") as 'kelas' | 'tugas';
    const target_id = parseInt(formData.get("target_id") as string);

    if (!topik || !pesan || !target_type || !target_id) {
      set.status = 400;
      return "Data tidak lengkap";
    }

    const newDiskusi: Diskusi = {
      id: diskusi.length > 0 ? Math.max(...diskusi.map(d => d.id)) + 1 : 1,
      topik,
      pesan,
      pengirim_id: user.userId,
      target_type,
      target_id,
      created_at: new Date()
    };

    diskusi.push(newDiskusi);

    set.status = 302;
    set.headers.Location = "/guru/diskusi?message=Pesan berhasil dikirim";
    return;
  })

  
  .get("/guru/profil", async ({ set, user }) => {
    if (!user || user.role !== "guru") {
      set.status = 302;
      set.headers.Location = "/login?error=Akses ditolak";
      return;
    }

    const guru = users.find(u => u.id === user.userId);
    const kelasDiampu = classes.filter(c => c.wali_kelas_id === user.userId);

    const mapelDiajar = guruMengajar
      .filter(gm => gm.guru_id === user.userId)
      .map(gm => {
        const mapel = mataPelajaran.find(mp => mp.id === gm.mata_pelajaran_id);
        const kelas = classes.find(c => c.id === gm.kelas_id);
        return {
          id: gm.id,
          nama_mapel: mapel?.nama,
          nama_kelas: kelas?.nama
        };
      });

    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return render("views/guru/profil.ejs", {
      user: { ...user, nama: guru?.nama, email: guru?.email },
      kelasDiampu,
      mapelDiajar
    });
  });
