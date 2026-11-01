import type { Click, Link, LinkRepository } from "../types.js";

export class MemoryLinkRepository implements LinkRepository {
  protected links = new Map<string, Link>();

  async create(link: Link): Promise<void> {
    this.links.set(link.slug, structuredClone(link));
  }

  async findBySlug(slug: string): Promise<Link | undefined> {
    const link = this.links.get(slug);
    return link ? structuredClone(link) : undefined;
  }

  async list(): Promise<Link[]> {
    return [...this.links.values()]
      .map((link) => structuredClone(link))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(slug: string): Promise<boolean> {
    return this.links.delete(slug);
  }

  async addClick(slug: string, click: Click): Promise<void> {
    this.links.get(slug)?.clicks.push(click);
  }
}
