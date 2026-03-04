import { router } from "./trpc";
import { projectsRouter } from "./projects/projects.router";
import { mediaRouter } from "./media/media.router";
import { billingRouter } from "./billing/billing.router";

export const appRouter = router({
  projects: projectsRouter,
  media: mediaRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
