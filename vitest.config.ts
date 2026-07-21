import { defineConfig } from "vitest/config";
import { parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envTest = parse(fs.readFileSync(path.resolve(__dirname, ".env.test")));

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    env: envTest,
    globalSetup: ["./tests/globalSetup.ts"],
    // ponytail: sequential file runs, simplest way to avoid cross-file
    // contention on a single shared test Postgres. Revisit if the suite gets
    // slow enough to need per-worker databases.
    fileParallelism: false,
  },
});
