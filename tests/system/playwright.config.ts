import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5175", trace: "retain-on-failure" },
});
