import { execFileSync } from "node:child_process";

// Les tests qui touchent la base utilisent nmb_test, jamais la base de développement.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://nmb:nmb@localhost:5432/nmb_test";
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
