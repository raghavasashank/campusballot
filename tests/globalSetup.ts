import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import path from "node:path";

// ponytail: `prisma dev`'s local proxy can't handle two real concurrent
// connections (verified: every concurrent query pair failed with
// "Connection terminated unexpectedly" / ECONNRESET). Tests that exercise
// row-locking under real concurrency (the vote-casting race test) need an
// actual multi-connection Postgres, so tests run against a real embedded
// Postgres binary instead.
const PORT = 54339;
const DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORT}/campusballot_test?sslmode=disable`;

const pg = new EmbeddedPostgres({
  databaseDir: path.resolve(__dirname, "../.pgdata-test"),
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: false,
});

export async function setup() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("campusballot_test");
  execSync("npx prisma db push --url " + JSON.stringify(DATABASE_URL), {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });
}

export async function teardown() {
  await pg.stop();
}
