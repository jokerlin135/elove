import { router } from "./trpc";
import { projectsRouter } from "./projects/projects.router";

export const appRouter = router({
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
