import { createRouter, publicQuery } from "./middleware";
import { worldRouter } from "./worldRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  world: worldRouter,
});

export type AppRouter = typeof appRouter;
