/**
 * A throwaway Postgres for local work.
 *
 * Postgres compiled to WebAssembly, served on a real socket, so the site talks
 * to it exactly as it will talk to Replit or Neon. Nothing to install, and it
 * starts empty every time.
 *
 *   npm run dev:db                       # in one terminal
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres npm run dev
 *
 * For a database that survives a restart, point a real Postgres at
 * DATABASE_URL instead. The schema is created on first use either way.
 */

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.DEV_DB_PORT ?? 5433);

async function main() {
  const db = await PGlite.create(process.env.DEV_DB_DIR);
  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
  await server.start();

  console.log(
    `Postgres on 127.0.0.1:${PORT}\n` +
      `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres\n` +
      (process.env.DEV_DB_DIR
        ? `Storing data in ${process.env.DEV_DB_DIR}\n`
        : `In memory: everything goes when you stop it. Set DEV_DB_DIR to keep it.\n`),
  );

  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
