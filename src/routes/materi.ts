import { Elysia } from "elysia";
import { materi } from "../db";
import { authMiddleware } from "../middleware/auth";

let lastMateriId = 0;

export const materiRoutes = new Elysia()
  
  .derive(authMiddleware)

  
  .get("/materi", ({ user }) => {
    if (!user) return new Response("Unauthorized", { status: 401 });
    return Response.json(materi);
  })

  .post("/materi", async ({ body, user }) => {
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { judul, deskripsi } = body as { judul: string; deskripsi: string };

    const newMateri = {
      id: ++lastMateriId,
      judul,
      deskripsi,
      created_by: user.id,
      created_at: new Date(),
    };

    materi.push(newMateri);

    return Response.json(newMateri);
  })
  .delete("/materi/:id", ({ params, user }) => {
    if (!user) return new Response("Unauthorized", { status: 401 });

    if (user.role === "siswa") {
      return new Response("Forbidden: siswa tidak boleh hapus materi", { status: 403 });
    }

    const idx = materi.findIndex((m) => m.id === Number(params.id));
    if (idx === -1) return new Response("Materi tidak ditemukan", { status: 404 });

    materi.splice(idx, 1);
    return new Response("Materi dihapus");
  });
