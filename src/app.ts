import Fastify, { type FastifyServerOptions } from "fastify";
import { linkRoutes } from "./routes/links.js";
import { MemoryLinkRepository } from "./storage/memory.js";
import type { LinkRepository } from "./types.js";

export interface AppOptions {
  repo?: LinkRepository;
  baseUrl?: string;
  logger?: FastifyServerOptions["logger"];
}

export function buildApp({ repo = new MemoryLinkRepository(), baseUrl, logger = false }: AppOptions = {}) {
  const app = Fastify({ logger });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(linkRoutes, { repo, baseUrl });

  return app;
}
