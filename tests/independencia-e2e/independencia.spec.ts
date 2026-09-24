import { test, expect } from "@playwright/test";

test("remote titles remain text and executable URLs are rejected", async ({
  page,
}) => {
  const stamp = new Date().toISOString();
  const unavailable = { status: "error", fetchedAt: null, url: "", data: null };
  const title = '<img src=x onerror="document.body.dataset.injected=1">';
  await page.route("**/chile/independencia.json", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        commune: { cut: "13108", name: "Independencia" },
        generatedAt: stamp,
        sources: {
          weather: unavailable,
          territory: unavailable,
          municipal: {
            status: "ok",
            fetchedAt: stamp,
            url: "https://www.independencia.cl/feed/",
            data: [{ title, url: "javascript:alert(1)", publishedAt: stamp }],
          },
        },
      },
    }),
  );
  await page.goto("/independencia.html");
  await expect(page.locator(".news-item h3")).toHaveText(title);
  await expect(page.locator(".news-item")).toHaveAttribute("href", "#");
  await expect(page.locator(".news-item img")).toHaveCount(0);
  expect(await page.locator("body").getAttribute("data-injected")).toBeNull();
});

test("public-source screen renders, switches to dispatch and opens traceability", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/independencia.html");
  await expect(page).toHaveTitle("Independencia en línea · Chile Monitor");
  await expect(page.locator("h1")).toContainText("Independencia");
  await expect(page.locator("#connection-banner")).not.toContainText(
    "Conectando",
  );
  await expect(page.locator("#municipal-capacity")).toBeVisible();
  await expect(
    page.getByText("Incidentes 1469: sin acceso", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("#commune-map canvas")).toBeVisible();
  await page
    .locator("#map-message")
    .waitFor({ state: "hidden", timeout: 20_000 })
    .catch(() => {});
  await page.screenshot({
    path: testInfo.outputPath("independencia-morning.png"),
    fullPage: true,
  });
  await page.locator('.mode-switch [data-mode="dispatch"]').click();
  await expect(page.locator("body")).toHaveClass(/dispatch-mode/);
  await expect(page.locator("#briefing")).toBeHidden();
  await expect(page).toHaveURL(/modo=despacho/);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(1100);
  await page.screenshot({
    path: testInfo.outputPath("independencia-dispatch.png"),
    fullPage: true,
  });
  await page.locator("#source-footer").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Para conectar el despacho municipal"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar fuentes" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(errors).toEqual([]);
});

test("missing data shows unknowns and connection gaps, not a false all-clear", async ({
  page,
}) => {
  await page.route("**/chile/independencia.json", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.goto("/independencia.html");
  await expect(page.locator("#connection-banner")).toContainText(
    "No se pudo actualizar",
  );
  await expect(page.locator(".metric-value").nth(0)).toHaveText("—");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("—municipales");
  await expect(page.locator("#metrics .source-state.fresh")).toHaveCount(0);
  await expect(page.locator(".dispatch-systems")).toContainText("sin acceso");
});

test("phone layout keeps actions reachable without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/independencia.html");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator('.mode-switch [data-mode="dispatch"]').click();
  await expect(page.locator("body")).toHaveClass(/dispatch-mode/);
  const width = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
});

test("Monitor Municipios exposes actual inventory, periods and all dimensions", async ({
  page,
}) => {
  await page.goto("/independencia.html");
  await expect(page.locator("#municipality-overview")).toContainText(
    "28 dimensiones con datos de 32 consultadas",
  );
  await expect(page.locator(".municipality-card").first()).toContainText("100");
  await expect(page.locator(".municipality-card").first()).toContainText(
    "2025",
  );
  await page.locator(".municipality-card").first().click();
  await expect(page.locator("#municipality-dialog")).toBeVisible();
  await expect(page.locator("#municipality-tabs button")).toHaveCount(32);
  await expect(page.locator("#municipality-detail")).toContainText(
    "Cámaras de vigilancia",
  );
  await expect(page.locator("#municipality-detail")).toContainText("2025");
  await page
    .locator('#municipality-tabs [data-municipality-section="presupuesto"]')
    .click();
  await expect(page.locator("#municipality-detail")).toContainText(
    "39.055.551.000",
  );
  await page
    .locator('#municipality-tabs [data-municipality-section="aire"]')
    .click();
  await expect(page.locator("#municipality-detail")).toContainText(
    "Sin registros para Independencia",
  );
  await page.getByRole("button", { name: "Cerrar base municipal" }).click();
  await page.locator('.mode-switch [data-mode="dispatch"]').click();
  await expect(page.locator("#dispatch-context")).toBeVisible();
  await expect(page.locator("#dispatch-context")).toContainText("100");
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(1100);
});
