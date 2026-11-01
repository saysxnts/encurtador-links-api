import { buildApp } from "./app.js";
import { JsonFileLinkRepository } from "./storage/json-file.js";
import { MemoryLinkRepository } from "./storage/memory.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const dataFile = process.env.DATA_FILE;

const repo = dataFile ? await JsonFileLinkRepository.open(dataFile) : new MemoryLinkRepository();
const app = buildApp({ repo, baseUrl: process.env.BASE_URL, logger: true });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port, host });
  app.log.info(dataFile ? `Persistindo links em ${dataFile}` : "Armazenamento em memória (defina DATA_FILE para persistir)");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
