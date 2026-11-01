import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const BASE = "http://sho.rt";

describe("API de links", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp({ baseUrl: BASE });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  const create = (payload: object) => app.inject({ method: "POST", url: "/api/links", payload });

  it("responde ao health check", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("cria um link com slug gerado", async () => {
    const res = await create({ url: "https://example.com/artigo" });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.slug).toMatch(/^[a-zA-Z0-9]{7}$/);
    expect(body.shortUrl).toBe(`${BASE}/${body.slug}`);
    expect(body.totalClicks).toBe(0);
    expect(body.expired).toBe(false);
  });

  it("cria um link com slug personalizado", async () => {
    const res = await create({ url: "https://example.com", slug: "meu-link" });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe("meu-link");
  });

  it("rejeita slug duplicado com 409", async () => {
    await create({ url: "https://example.com", slug: "repetido" });
    const res = await create({ url: "https://example.org", slug: "repetido" });
    expect(res.statusCode).toBe(409);
  });

  it("rejeita slug reservado", async () => {
    const res = await create({ url: "https://example.com", slug: "api" });
    expect(res.statusCode).toBe(400);
  });

  it.each([
    [{}, "url"],
    [{ url: "não é url" }, "url"],
    [{ url: "ftp://example.com" }, "url"],
    [{ url: "https://example.com", slug: "a" }, "slug"],
    [{ url: "https://example.com", slug: "com espaço" }, "slug"],
    [{ url: "https://example.com", expiresAt: "amanhã" }, "expiresAt"],
  ])("valida payload inválido %j", async (payload, field) => {
    const res = await create(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json().details.map((d: { field: string }) => d.field)).toContain(field);
  });

  it("rejeita expiração no passado", async () => {
    const res = await create({ url: "https://example.com", expiresAt: "2000-01-01T00:00:00Z" });
    expect(res.statusCode).toBe(400);
  });

  it("redireciona e registra o clique", async () => {
    await create({ url: "https://example.com/destino", slug: "destino" });

    const res = await app.inject({
      method: "GET",
      url: "/destino",
      headers: { referer: "https://news.site", "user-agent": "vitest" },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/destino");

    const details = await app.inject({ method: "GET", url: "/api/links/destino" });
    expect(details.json().totalClicks).toBe(1);
  });

  it("retorna 404 para slug inexistente", async () => {
    expect((await app.inject({ method: "GET", url: "/nada" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/links/nada" })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: "/api/links/nada" })).statusCode).toBe(404);
  });

  it("retorna 410 para link expirado", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await create({ url: "https://example.com", slug: "temporario", expiresAt: "2026-01-02T00:00:00Z" });

    expect((await app.inject({ method: "GET", url: "/temporario" })).statusCode).toBe(302);

    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));
    expect((await app.inject({ method: "GET", url: "/temporario" })).statusCode).toBe(410);
    expect((await app.inject({ method: "GET", url: "/api/links/temporario" })).json().expired).toBe(true);
  });

  it("lista e remove links", async () => {
    await create({ url: "https://a.com", slug: "aaa" });
    await create({ url: "https://b.com", slug: "bbb" });

    const list = await app.inject({ method: "GET", url: "/api/links" });
    expect(list.json().map((l: { slug: string }) => l.slug).sort()).toEqual(["aaa", "bbb"]);

    expect((await app.inject({ method: "DELETE", url: "/api/links/aaa" })).statusCode).toBe(204);
    const after = await app.inject({ method: "GET", url: "/api/links" });
    expect(after.json()).toHaveLength(1);
  });

  it("gera estatísticas de cliques", async () => {
    await create({ url: "https://example.com", slug: "stats" });
    for (const referer of ["https://x.com", "https://x.com", undefined]) {
      await app.inject({ method: "GET", url: "/stats", headers: referer ? { referer } : {} });
    }

    const res = await app.inject({ method: "GET", url: "/api/links/stats/stats" });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.totalClicks).toBe(3);
    expect(Object.values(stats.clicksByDay)).toEqual([3]);
    expect(stats.topReferrers).toEqual([
      { referrer: "https://x.com", clicks: 2 },
      { referrer: "direto", clicks: 1 },
    ]);
  });
});
