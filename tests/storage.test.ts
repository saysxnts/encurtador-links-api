import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateSlug } from "../src/slug.js";
import { buildStats } from "../src/stats.js";
import { JsonFileLinkRepository } from "../src/storage/json-file.js";
import type { Link } from "../src/types.js";

const sample = (slug: string): Link => ({
  slug,
  url: "https://example.com",
  createdAt: new Date().toISOString(),
  expiresAt: null,
  clicks: [],
});

describe("JsonFileLinkRepository", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "encurtador-"));
    file = join(dir, "sub", "links.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("começa vazio quando o arquivo não existe", async () => {
    const repo = await JsonFileLinkRepository.open(file);
    expect(await repo.list()).toEqual([]);
  });

  it("persiste links e cliques entre instâncias", async () => {
    const repo = await JsonFileLinkRepository.open(file);
    await repo.create(sample("abc"));
    await repo.create(sample("def"));
    await repo.addClick("abc", { at: new Date().toISOString(), referrer: null, userAgent: null });
    await repo.delete("def");

    const saved = JSON.parse(await readFile(file, "utf8"));
    expect(saved).toHaveLength(1);

    const reopened = await JsonFileLinkRepository.open(file);
    const link = await reopened.findBySlug("abc");
    expect(link?.clicks).toHaveLength(1);
    expect(await reopened.findBySlug("def")).toBeUndefined();
  });
});

describe("generateSlug", () => {
  it("gera slugs no tamanho pedido sem caracteres ambíguos", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateSlug(10);
      expect(slug).toHaveLength(10);
      expect(slug).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("buildStats", () => {
  it("retorna valores zerados para link sem cliques", () => {
    expect(buildStats(sample("x"))).toEqual({
      slug: "x",
      totalClicks: 0,
      lastClickAt: null,
      clicksByDay: {},
      topReferrers: [],
    });
  });

  it("agrupa cliques por dia", () => {
    const link = sample("y");
    link.clicks = [
      { at: "2026-10-30T10:00:00.000Z", referrer: null, userAgent: null },
      { at: "2026-10-30T23:00:00.000Z", referrer: null, userAgent: null },
      { at: "2026-10-31T08:00:00.000Z", referrer: "https://a.com", userAgent: null },
    ];
    const stats = buildStats(link);
    expect(stats.clicksByDay).toEqual({ "2026-10-30": 2, "2026-10-31": 1 });
    expect(stats.lastClickAt).toBe("2026-10-31T08:00:00.000Z");
  });
});
