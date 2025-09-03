import { Elysia } from 'elysia';
import { authRoutes } from './routes/auth';
import { dashboardRoutes } from './routes/dashboard';

const app = new Elysia()
  .use(authRoutes)
  .use(dashboardRoutes)
  .get('/', ({ set }) => {
    set.redirect = '/login';
  })
  .listen(3000);

console.log(` Server berjalan di http://${app.server?.hostname}:${app.server?.port}`);
