// ponytail: `prisma dev`'s local proxy proved unreliable for raw connections
// (see README "Tests" section — same issue hit here). This starts a real,
// persistent embedded Postgres for local dev instead. Run once, leave running.
const EmbeddedPostgres = require("embedded-postgres").default ?? require("embedded-postgres");
const path = require("node:path");
const fs = require("node:fs");

const dataDir = path.resolve(__dirname, "../.pgdata-dev");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 54330,
  persistent: true,
});

(async () => {
  const alreadyInitialised = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (!alreadyInitialised) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase("campusballot");
  } catch {
    // already exists, fine
  }
  console.log("Dev Postgres ready at postgresql://postgres:postgres@localhost:54330/campusballot?sslmode=disable");
})();
