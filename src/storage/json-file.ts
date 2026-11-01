import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Click, Link } from "../types.js";
import { MemoryLinkRepository } from "./memory.js";

/**
 * Keeps links in memory and persists every change to a JSON file.
 * Writes go to a temp file first and are then renamed, so a crash
 * mid-write never leaves a truncated data file behind.
 */
export class JsonFileLinkRepository extends MemoryLinkRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(private readonly filePath: string) {
    super();
  }

  static async open(filePath: string): Promise<JsonFileLinkRepository> {
    const repo = new JsonFileLinkRepository(filePath);
    try {
      const data = JSON.parse(await readFile(filePath, "utf8")) as Link[];
      for (const link of data) repo.links.set(link.slug, link);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    return repo;
  }

  override async create(link: Link): Promise<void> {
    await super.create(link);
    await this.persist();
  }

  override async delete(slug: string): Promise<boolean> {
    const removed = await super.delete(slug);
    if (removed) await this.persist();
    return removed;
  }

  override async addClick(slug: string, click: Click): Promise<void> {
    await super.addClick(slug, click);
    await this.persist();
  }

  private persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await writeFile(tmp, JSON.stringify([...this.links.values()], null, 2));
      await rename(tmp, this.filePath);
    });
    return this.writeQueue;
  }
}
