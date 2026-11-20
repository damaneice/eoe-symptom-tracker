import { signedInEmail, type AuthEnv } from "./auth";
import { match } from "./routes";

type WorkerEnv = Env & AuthEnv;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const email = await signedInEmail(request, env, ctx.access);
    if (!email) return Response.json({ error: "Not signed in" }, { status: 401 });

    if (url.pathname === "/api/health") {
      const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return Response.json({ ok: row?.ok === 1 });
    }

    const route = match(request.method, url.pathname);
    if (!route) return Response.json({ error: "Not found" }, { status: 404 });

    const body = await request.json().catch(() => undefined);
    return route.handler({ db: env.DB, email, params: route.params, body });
  },
} satisfies ExportedHandler<WorkerEnv>;
