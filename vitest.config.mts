import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://nmb:nmb@localhost:5432/nmb_test",
      PAYMENT_PROVIDER: "simulation",
      PAYMENT_WEBHOOK_SECRET: "secret-de-test",
      IP_HASH_SECRET: "secret-de-test",
    },
  },
});
