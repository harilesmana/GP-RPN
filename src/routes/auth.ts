import { Elysia } from "elysia";
import { users } from "../db";
import { verifyPassword, hashPassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import ejs from "ejs";
import { readFileSync } from "fs";
import { join } from "path";

let lastId = users.length;

// helper render ejs
function render(view: string, data: any = {}) {
  const file = readFileSync(join(import.meta.dir, "../../views", view), "utf8");
  return ejs.render(file, data);
}

export const authRoutes = new Elysia()
  // login routes
  .get("/login", () => new Response(render("login.ejs"), { headers: { "Content-Type": "text/html" } }))
  
  .post("/login", async ({ body }) => {
    const { email, password } = body as { email: string; password: string };

    const user = users.find((u) => u.email === email);
    if (!user) return new Response("Email tidak ditemukan", { status: 401 });

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return new Response("Password salah", { status: 401 });

    const token = generateToken({ id: user.id, role: user.role });

    switch (user.role) {
      case "kepsek":
        return new Response(render("dashboard/kepsek.ejs", { user, token }), { headers: { "Content-Type": "text/html" } });
      case "guru":
        return new Response(render("dashboard/guru.ejs", { user, token }), { headers: { "Content-Type": "text/html" } });
      case "siswa":
        return new Response(render("dashboard/siswa.ejs", { user, token }), { headers: { "Content-Type": "text/html" } });
    }
  })
// registrasi 
  .get("/register", () => new Response(render("register.ejs"), { headers: { "Content-Type": "text/html" } }))
  
  .post("/register", async ({ body }) => {
    const { nama, email, password } = body as any;

    if (users.find((u) => u.email === email)) {
      return new Response("Email sudah ada", { status: 400 });
    }

    const newUser = {
      id: ++lastId,
      nama,
      email,
      password_hash: await hashPassword(password),
      role: "siswa", // otomatis siswa
    };

    users.push(newUser);

    return new Response("Registrasi berhasil. Silakan login.", { status: 200 });
  });
