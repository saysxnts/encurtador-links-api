import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { generateSlug, RESERVED_SLUGS } from "../slug.js";
import { buildStats } from "../stats.js";
import type { Link, LinkRepository } from "../types.js";

const createLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "url deve ser um endereço http(s) válido" }).max(2048),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/, "slug deve ter 3-32 caracteres: letras, números, _ ou -")
    .optional(),
  expiresAt: z.iso.datetime({ error: "expiresAt deve ser uma data ISO 8601" }).optional(),
});

const slugParams = z.object({ slug: z.string() });

interface Options {
  repo: LinkRepository;
  baseUrl?: string;
}

function isExpired(link: Link, now = new Date()): boolean {
  return link.expiresAt !== null && new Date(link.expiresAt) <= now;
}

function present(link: Link, base: string) {
  return {
    slug: link.slug,
    url: link.url,
    shortUrl: `${base}/${link.slug}`,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    expired: isExpired(link),
    totalClicks: link.clicks.length,
  };
}

function resolveBase(req: FastifyRequest, baseUrl?: string): string {
  return (baseUrl ?? `${req.protocol}://${req.host}`).replace(/\/+$/, "");
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "Link não encontrado" });
}

export async function linkRoutes(app: FastifyInstance, { repo, baseUrl }: Options) {
  app.post("/api/links", async (req, reply) => {
    const parsed = createLinkSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    const { url, slug: customSlug, expiresAt } = parsed.data;

    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return reply.code(400).send({ error: "expiresAt deve estar no futuro" });
    }

    let slug = customSlug;
    if (slug) {
      if (RESERVED_SLUGS.has(slug.toLowerCase())) {
        return reply.code(400).send({ error: `O slug "${slug}" é reservado` });
      }
      if (await repo.findBySlug(slug)) {
        return reply.code(409).send({ error: `O slug "${slug}" já está em uso` });
      }
    } else {
      do slug = generateSlug();
      while (await repo.findBySlug(slug));
    }

    const link: Link = {
      slug,
      url,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      clicks: [],
    };
    await repo.create(link);
    return reply.code(201).send(present(link, resolveBase(req, baseUrl)));
  });

  app.get("/api/links", async (req) => {
    const base = resolveBase(req, baseUrl);
    return (await repo.list()).map((link) => present(link, base));
  });

  app.get("/api/links/:slug", async (req, reply) => {
    const { slug } = slugParams.parse(req.params);
    const link = await repo.findBySlug(slug);
    if (!link) return notFound(reply);
    return present(link, resolveBase(req, baseUrl));
  });

  app.get("/api/links/:slug/stats", async (req, reply) => {
    const { slug } = slugParams.parse(req.params);
    const link = await repo.findBySlug(slug);
    if (!link) return notFound(reply);
    return buildStats(link);
  });

  app.delete("/api/links/:slug", async (req, reply) => {
    const { slug } = slugParams.parse(req.params);
    if (!(await repo.delete(slug))) return notFound(reply);
    return reply.code(204).send();
  });

  app.get("/:slug", async (req, reply) => {
    const { slug } = slugParams.parse(req.params);
    const link = await repo.findBySlug(slug);
    if (!link) return notFound(reply);
    if (isExpired(link)) return reply.code(410).send({ error: "Link expirado" });

    await repo.addClick(slug, {
      at: new Date().toISOString(),
      referrer: req.headers.referer ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return reply.redirect(link.url, 302);
  });
}
