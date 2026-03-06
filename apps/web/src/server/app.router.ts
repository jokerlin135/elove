import { router } from "./trpc";
import { projectsRouter } from "./projects/projects.router";
import { mediaRouter } from "./media/media.router";
import { billingRouter } from "./billing/billing.router";
import { templatesRouter } from "./templates/templates.router";
import { guestsRouter } from "./guests/guests.router";

export const appRouter = router({
  projects: projectsRouter,
  media: mediaRouter,
  billing: billingRouter,
  templates: templatesRouter,
  guests: guestsRouter,
});

export type AppRouter = typeof appRouter;
