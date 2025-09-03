import { Elysia } from "elysia";
import { quiz, pertanyaan, nilai, materi, users } from "../db";
import { authMiddleware } from "../middleware/auth";
import { quizSchema, pertanyaanSchema, jawabanSchema, inputValidation } from "../middleware/inputValidation";

let lastQuizId = quiz.length > 0 ? Math.max(...quiz.map(q => q.id)) : 0;
let lastPertanyaanId = pertanyaan.length > 0 ? Math.max(...pertanyaan.map(p => p.id)) : 0;
let lastNilaiId = nilai.length > 0 ? Math.max(...nilai.map(n => n.id)) : 0;

export const quizRoutes = new Elysia()
  .use(inputValidation)
  .derive(authMiddleware as any)


  .get("/quiz", ({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const quizDenganMateri = quiz.map(q => {
      const materiQuiz = materi.find(m => m.id === q.materi_id);
      const userQuiz = users.find(u => u.id === q.created_by);
      return {
        ...q,
        materi: materiQuiz ? { id: materiQuiz.id, judul: materiQuiz.judul } : null,
        created_by_user: userQuiz ? { id: userQuiz.id, nama: userQuiz.nama } : null
      };
    });

    return { data: quizDenganMateri };
  })


  .get("/materi/:id/quiz", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const materiId = Number(params.id);
    if (isNaN(materiId)) {
      set.status = 400;
      return { error: "ID materi tidak valid" };
    }

    const quizMateri = quiz.filter(q => q.materi_id === materiId);
    const quizDenganMateri = quizMateri.map(q => {
      const materiQuiz = materi.find(m => m.id === q.materi_id);
      const userQuiz = users.find(u => u.id === q.created_by);
      return {
        ...q,
        materi: materiQuiz ? { id: materiQuiz.id, judul: materiQuiz.judul } : null,
        created_by_user: userQuiz ? { id: userQuiz.id, nama: userQuiz.nama } : null
      };
    });

    return { data: quizDenganMateri };
  })


  .get("/quiz/:id", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const quizId = Number(params.id);
    if (isNaN(quizId)) {
      set.status = 400;
      return { error: "ID quiz tidak valid" };
    }

    const quizDetail = quiz.find(q => q.id === quizId);
    if (!quizDetail) {
      set.status = 404;
      return { error: "Quiz tidak ditemukan" };
    }

    const pertanyaanQuiz = pertanyaan.filter(p => p.quiz_id === quizId);
    const materiQuiz = materi.find(m => m.id === quizDetail.materi_id);
    const userQuiz = users.find(u => u.id === quizDetail.created_by);


    const pertanyaanUntukUser = user.role === "siswa"
      ? pertanyaanQuiz.map(p => ({
        id: p.id,
        quiz_id: p.quiz_id,
        teks: p.teks,
        opsi_a: p.opsi_a,
        opsi_b: p.opsi_b,
        opsi_c: p.opsi_c,
        opsi_d: p.opsi_d,
        created_at: p.created_at
      }))
      : pertanyaanQuiz;

    return {
      data: {
        ...quizDetail,
        materi: materiQuiz ? { id: materiQuiz.id, judul: materiQuiz.judul } : null,
        created_by_user: userQuiz ? { id: userQuiz.id, nama: userQuiz.nama } : null,
        pertanyaan: pertanyaanUntukUser,
        total_pertanyaan: pertanyaanQuiz.length
      }
    };
  })


  .post("/quiz", async ({ sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek" && user.role !== "guru") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek dan guru yang boleh membuat quiz" };
    }

    const { materi_id, judul } = sanitizedBody as { materi_id: number; judul: string };

    try {
      quizSchema.parse({ materi_id, judul });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }


    const materiExists = materi.find(m => m.id === materi_id);
    if (!materiExists) {
      set.status = 404;
      return { error: "Materi tidak ditemukan" };
    }

    const newQuiz = {
      id: ++lastQuizId,
      materi_id,
      judul,
      created_by: user.id,
      created_at: new Date(),
    };

    quiz.push(newQuiz);

    return { data: newQuiz, message: "Quiz berhasil dibuat" };
  })


  .post("/quiz/:id/pertanyaan", async ({ params, sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek" && user.role !== "guru") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek dan guru yang boleh menambah pertanyaan" };
    }

    const quizId = Number(params.id);
    if (isNaN(quizId)) {
      set.status = 400;
      return { error: "ID quiz tidak valid" };
    }

    const { teks, opsi_a, opsi_b, opsi_c, opsi_d, jawaban_benar } = sanitizedBody as any;

    try {
      pertanyaanSchema.parse({
        quiz_id: quizId,
        teks,
        opsi_a,
        opsi_b,
        opsi_c,
        opsi_d,
        jawaban_benar
      });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }


    const quizExists = quiz.find(q => q.id === quizId);
    if (!quizExists) {
      set.status = 404;
      return { error: "Quiz tidak ditemukan" };
    }

    if (quizExists.created_by !== user.id && user.role !== "kepsek") {
      set.status = 403;
      return { error: "Forbidden: hanya pembuat quiz atau kepsek yang boleh menambah pertanyaan" };
    }

    const newPertanyaan = {
      id: ++lastPertanyaanId,
      quiz_id: quizId,
      teks,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d,
      jawaban_benar,
      created_at: new Date(),
    };

    pertanyaan.push(newPertanyaan);

    return { data: newPertanyaan, message: "Pertanyaan berhasil ditambahkan" };
  })


  .post("/quiz/:id/submit", async ({ params, sanitizedBody, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "siswa") {
      set.status = 403;
      return { error: "Forbidden: hanya siswa yang boleh mengsubmit quiz" };
    }

    const quizId = Number(params.id);
    if (isNaN(quizId)) {
      set.status = 400;
      return { error: "ID quiz tidak valid" };
    }

    const { jawaban } = sanitizedBody as { jawaban: Record<string, 'a' | 'b' | 'c' | 'd'> };

    try {
      jawabanSchema.parse({ jawaban });
    } catch (error: any) {
      set.status = 400;
      return { error: error.errors[0].message };
    }


    const quizExists = quiz.find(q => q.id === quizId);
    if (!quizExists) {
      set.status = 404;
      return { error: "Quiz tidak ditemukan" };
    }


    const pertanyaanQuiz = pertanyaan.filter(p => p.quiz_id === quizId);
    if (pertanyaanQuiz.length === 0) {
      set.status = 400;
      return { error: "Quiz tidak memiliki pertanyaan" };
    }


    let skor = 0;
    const hasilPertanyaan: any[] = [];

    pertanyaanQuiz.forEach(pertanyaan => {
      const jawabanUser = jawaban[pertanyaan.id];
      const benar = jawabanUser === pertanyaan.jawaban_benar;

      if (benar) {
        skor++;
      }

      hasilPertanyaan.push({
        pertanyaan_id: pertanyaan.id,
        teks: pertanyaan.teks,
        jawaban_user: jawabanUser,
        jawaban_benar: pertanyaan.jawaban_benar,
        benar: benar
      });
    });

    const nilaiPersen = (skor / pertanyaanQuiz.length) * 100;


    const newNilai = {
      id: ++lastNilaiId,
      quiz_id: quizId,
      user_id: user.id,
      skor: nilaiPersen,
      total_pertanyaan: pertanyaanQuiz.length,
      created_at: new Date(),
    };

    nilai.push(newNilai);

    return {
      data: {
        nilai: newNilai,
        detail: hasilPertanyaan,
        summary: {
          benar: skor,
          salah: pertanyaanQuiz.length - skor,
          total: pertanyaanQuiz.length,
          persentase: nilaiPersen
        }
      },
      message: "Quiz berhasil disubmit"
    };
  })


  .get("/quiz/:id/nilai", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const quizId = Number(params.id);
    if (isNaN(quizId)) {
      set.status = 400;
      return { error: "ID quiz tidak valid" };
    }

    const nilaiUser = nilai.filter(n => n.quiz_id === quizId && n.user_id === user.id);

    return { data: nilaiUser };
  })


  .get("/quiz/:id/nilai/all", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek" && user.role !== "guru") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek dan guru yang boleh melihat semua nilai" };
    }

    const quizId = Number(params.id);
    if (isNaN(quizId)) {
      set.status = 400;
      return { error: "ID quiz tidak valid" };
    }

    const semuaNilai = nilai.filter(n => n.quiz_id === quizId);
    const nilaiDenganUser = semuaNilai.map(n => {
      const userNilai = users.find(u => u.id === n.user_id);
      return {
        ...n,
        user: userNilai ? { id: userNilai.id, nama: userNilai.nama } : null
      };
    });

    return { data: nilaiDenganUser };
  })


  .delete("/quiz/:id", ({ params, user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "kepsek" && user.role !== "guru") {
      set.status = 403;
      return { error: "Forbidden: hanya kepsek dan guru yang boleh menghapus quiz" };
    }

    const quizId = Number(params.id);
    if (isNaN(quizId)) {
      set.status = 400;
      return { error: "ID quiz tidak valid" };
    }

    const quizIndex = quiz.findIndex(q => q.id === quizId);
    if (quizIndex === -1) {
      set.status = 404;
      return { error: "Quiz tidak ditemukan" };
    }

    const quizToDelete = quiz[quizIndex];


    if (quizToDelete.created_by !== user.id && user.role !== "kepsek") {
      set.status = 403;
      return { error: "Forbidden: hanya pembuat quiz atau kepsek yang boleh menghapus" };
    }


    const pertanyaanIndexes: number[] = [];
    pertanyaan.forEach((p, index) => {
      if (p.quiz_id === quizId) {
        pertanyaanIndexes.push(index);
      }
    });


    const nilaiIndexes: number[] = [];
    nilai.forEach((n, index) => {
      if (n.quiz_id === quizId) {
        nilaiIndexes.push(index);
      }
    });


    pertanyaanIndexes.reverse().forEach(index => {
      pertanyaan.splice(index, 1);
    });

    nilaiIndexes.reverse().forEach(index => {
      nilai.splice(index, 1);
    });

    quiz.splice(quizIndex, 1);

    return { message: "Quiz dan semua data terkait berhasil dihapus" };
  });
