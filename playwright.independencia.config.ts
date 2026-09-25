import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/independencia-e2e",
  testMatch: "independencia.spec.ts",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.INDEPENDENCIA_TEST_URL || "http://127.0.0.1:5177",
    viewport: { width: 1440, height: 1100 },
    headless: true,
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: process.env.INDEPENDENCIA_TEST_URL
    ? undefined
    : {
        command:
          "npm run dev:chile -- --host 127.0.0.1 --port 5177 --strictPort",
        url: "http://127.0.0.1:5177/independencia.html",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
