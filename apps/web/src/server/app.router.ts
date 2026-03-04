import { router } from "./trpc";
import { projectsRouter } from "./projects/projects.router";
import { mediaRouter } from "./media/media.router";

export const appRouter = router({
  projects: projectsRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
