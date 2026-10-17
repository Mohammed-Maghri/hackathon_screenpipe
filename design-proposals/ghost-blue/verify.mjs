import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright-core"
);
const base = process.env.PROPOSAL_URL || "http://127.0.0.1:4183/";
const root = fileURLToPath(new URL(".", import.meta.url));
await mkdir(`${root}screenshots`, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {},
);
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
const errors = [];
const checks = [];
page.setDefaultTimeout(8000);
const requests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => requests.push(request.url()));
const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
};
const go = async (route) => {
  await page.goto(`${base}#${route}`);
  await settle();
};
const check = (condition, name) => {
  assert.ok(condition, name);
  checks.push(name);
};
const screenshot = async (name) => {
  await settle();
  await page.screenshot({ path: `${root}screenshots/${name}.png` });
};
try {
  await go("workflows");
  const initialCount = await page.locator(".workflow-card").count();
  await page
    .getByRole("button", { name: "Run Weekly team update", exact: true })
    .click();
  check(
    await page.getByRole("dialog").isVisible(),
    "Card Run opens its own dialog",
  );
  check(page.url().endsWith("#workflows"), "Card Run does not open the editor");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await settle();
  check(
    await page
      .getByRole("button", { name: "Run Weekly team update", exact: true })
      .evaluate((el) => el === document.activeElement),
    "Dialog restores focus to the triggering action",
  );
  await page
    .getByRole("button", { name: "Schedule Weekly team update", exact: true })
    .click();
  check(
    await page
      .getByRole("heading", { name: "Schedule workflow", exact: true })
      .isVisible(),
    "Card Schedule opens its own dialog",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Delete Weekly team update", exact: true })
    .click();
  check(
    await page
      .getByRole("heading", { name: "Delete this sample workflow?" })
      .isVisible(),
    "Card Delete requests confirmation",
  );
  await page.getByRole("button", { name: "Keep workflow" }).click();
  check(
    (await page.locator(".workflow-card").count()) === initialCount,
    "Cancel preserves the sample workflow",
  );
  await page
    .getByRole("button", {
      name: "Open workflow: Weekly team update",
      exact: true,
    })
    .click();
  check(page.url().endsWith("#editor"), "Whole workflow card opens the editor");
  check(
    !(await page.locator(".editor-description > p").count()),
    "Workflow description starts collapsed",
  );
  await page.getByRole("button", { name: "About this workflow" }).click();
  check(
    await page.locator(".editor-description > p").isVisible(),
    "Workflow description expands on request",
  );
  await page.getByRole("button", { name: "About this workflow" }).click();
  const nodes = page.locator(".graph-node");
  await nodes.first().click();
  check(
    (await nodes.first().getAttribute("aria-pressed")) === "true",
    "Single click selects a node",
  );
  check(
    (await page.locator(".node-inspector").count()) === 0,
    "Single click leaves node settings closed",
  );
  await nodes.nth(1).dblclick();
  check(
    await page
      .getByRole("complementary", { name: "Node settings" })
      .isVisible(),
    "Double click opens node settings",
  );
  await page.getByRole("button", { name: "Close node settings" }).click();
  await nodes.first().focus();
  await page.keyboard.press("Enter");
  check(
    await page.locator(".node-inspector").isVisible(),
    "Enter opens node settings for keyboard users",
  );
  await page.getByRole("button", { name: "Close node settings" }).click();
  await page.getByRole("button", { name: "Add to workflow" }).click();
  check(
    await page.locator("#add-menu").isVisible(),
    "Plus opens an adjacent add menu",
  );
  await page
    .locator("#add-menu")
    .getByRole("button", { name: "Add node", exact: false })
    .click();
  check(
    await page
      .getByRole("heading", { name: "Add a node", exact: true })
      .isVisible(),
    "Add node opens the node-specific dialog",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add to workflow" }).click();
  await page
    .locator("#add-menu")
    .getByRole("button", { name: "Add connection", exact: false })
    .click();
  check(
    await page
      .getByRole("heading", { name: "Add a connection", exact: true })
      .isVisible(),
    "Add connection opens the connection-specific dialog",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add to workflow" }).click();
  await page.keyboard.press("Escape");
  check(
    !(await page.locator("#add-menu").count()),
    "Escape dismisses the add menu",
  );
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page.getByRole("button", { name: "Show sample result" }).click();
  check(
    await page.getByText("Preview run completed", { exact: true }).isVisible(),
    "Run preview displays a clearly labeled sample result",
  );
  await page.getByRole("button", { name: "Clear results" }).click();
  check(
    await page
      .getByRole("heading", { name: "No runs in this preview" })
      .isVisible(),
    "Clear removes sample run results",
  );
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  check((await nodes.count()) === 3, "Clear preserves workflow nodes");
  await go("workflows");
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page
    .getByRole("button", { name: "Use template: Summarize team updates" })
    .click();
  check(
    page.url().endsWith("#editor"),
    "Using a template opens an independent sample draft",
  );
  await go("workflows");
  await page.getByRole("button", { name: "Drafts", exact: true }).click();
  check(
    await page
      .getByRole("button", { name: "Open workflow: Summarize team updates" })
      .isVisible(),
    "Sample template draft appears in Drafts",
  );
  await page
    .getByRole("searchbox", { name: "Search workflows" })
    .fill("does-not-exist");
  check(
    await page
      .getByRole("heading", { name: "No matching workflows" })
      .isVisible(),
    "Workflow search has a useful empty state",
  );
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.keyboard.press("Control+k");
  check(
    await page.getByRole("dialog").isVisible(),
    "Ctrl+K opens workspace search",
  );
  await page.getByRole("textbox", { name: "Search workspace" }).fill("weekly");
  check(
    (await page.locator(".command-results").getByRole("button").count()) >= 1,
    "Workspace search filters sample workflows",
  );
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New workflow", exact: true })
    .click();
  check(
    await page.getByRole("heading", { name: "Create a workflow" }).isVisible(),
    "Search actions open their own form",
  );
  await page.keyboard.press("Escape");
  await go("home");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  check(
    await page.locator(".sidebar").evaluate((el) => el.clientWidth <= 72),
    "Sidebar collapses to a 72 px rail",
  );
  await page.reload();
  await settle();
  check(
    await page
      .getByRole("button", { name: "Expand sidebar", exact: true })
      .isVisible(),
    "Sidebar preference survives reload",
  );
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.getByRole("button", { name: "System theme", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await settle();
  check(
    (await page.locator("html").getAttribute("data-theme")) === "dark",
    "System theme follows dark OS preference",
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await settle();
  check(
    (await page.locator("html").getAttribute("data-theme")) === "light",
    "System theme follows live OS preference changes",
  );
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await page.reload();
  await settle();
  check(
    (await page.locator("html").getAttribute("data-theme")) === "dark",
    "Theme preference survives reload",
  );

  console.log("Interaction checks passed; reviewing responsive layouts.");
  // Reset all sample edits, then review every surface in both themes and at four desktop sizes.
  await page.reload();
  const matrix = [];
  for (const [width, height] of [
    [1440, 960],
    [1280, 800],
    [1024, 768],
    [760, 620],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page
        .getByRole("button", {
          name: `${theme[0].toUpperCase() + theme.slice(1)} theme`,
          exact: true,
        })
        .click();
      for (const route of [
        "home",
        "workflows",
        "editor",
        "settings",
        "record",
        "welcome",
        "system",
      ]) {
        await go(route);
        if (route === "workflows")
          await page
            .getByRole("button", { name: "All workflows", exact: false })
            .click();
        const bounds = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          main: document.querySelector("main").scrollWidth,
          mainClient: document.querySelector("main").clientWidth,
        }));
        check(
          bounds.document <= width &&
            bounds.body <= width &&
            bounds.main <= bounds.mainClient + 1,
          `${route} ${theme} fits ${width}×${height} without outer horizontal overflow`,
        );
        const unnamed = await page
          .locator("button")
          .evaluateAll(
            (buttons) =>
              buttons.filter(
                (el) =>
                  el.getBoundingClientRect().width &&
                  !el.disabled &&
                  !el.getAttribute("aria-label") &&
                  !el.textContent?.trim(),
              ).length,
          );
        check(
          unnamed === 0,
          `${route} ${theme} at ${width}px has named visible buttons`,
        );
        matrix.push({ route, theme, width, height, ...bounds });
        if (width === 1440) await screenshot(`${route}-${theme}`);
        if (width === 760 && ["home", "editor", "welcome"].includes(route))
          await screenshot(`${route}-${theme}-compact`);
        if (width === 760 && route === "welcome") {
          const action = await page
            .getByRole("button", { name: "Create my first workflow" })
            .boundingBox();
          check(
            action.y + action.height <= height,
            `Introduction primary action remains above the fold at ${width}×${height} in ${theme}`,
          );
        }
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await go("editor");
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await nodes.nth(2).dblclick();
  await screenshot("editor-inspector-light");
  await page.getByRole("button", { name: "Close node settings" }).click();
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await nodes.nth(2).dblclick();
  await screenshot("editor-inspector-dark");
  await go("home");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await screenshot("home-dark-collapsed");
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await screenshot("search-light");
  await page.keyboard.press("Escape");
  const contrast = [];
  const luminance = hex => {
    const rgb = hex.replace("#", "").match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  for (const theme of ["light", "dark"]) {
    await page.getByRole("button", { name: `${theme[0].toUpperCase() + theme.slice(1)} theme`, exact: true }).click();
    await settle();
    const values = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(["--text-primary", "--text-secondary", "--surface-canvas", "--surface-sidebar", "--surface-raised", "--accent-action", "--text-on-action", "--border-strong", "--status-success", "--status-warning", "--status-error"].map(name => [name, style.getPropertyValue(name).trim()]));
    });
    for (const [foreground, background, minimum] of [["--text-primary", "--surface-canvas", 4.5], ["--text-secondary", "--surface-canvas", 4.5], ["--text-secondary", "--surface-sidebar", 4.5], ["--text-secondary", "--surface-raised", 4.5], ["--text-on-action", "--accent-action", 4.5], ["--border-strong", "--surface-canvas", 3], ["--border-strong", "--surface-raised", 3], ["--status-success", "--surface-raised", 4.5], ["--status-warning", "--surface-raised", 4.5], ["--status-error", "--surface-raised", 4.5]]) {
      const a = luminance(values[foreground]);
      const b = luminance(values[background]);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      check(ratio >= minimum, `${theme} ${foreground} on ${background} reaches ${minimum}:1 contrast`);
      contrast.push({ theme, foreground, background, ratio: +ratio.toFixed(2), minimum });
    }
  }
  check(errors.length === 0, `No browser runtime errors (${errors.length})`);
  check(
    requests.every(
      (url) =>
        url.startsWith("http://127.0.0.1:4183/") ||
        url.startsWith("ws://127.0.0.1:4183/"),
    ),
    "Preview makes no app, backend, Screenpipe, or external-service requests",
  );
  const report = {
    status: "passed",
    checks: checks.length,
    browserErrors: errors,
    layouts: matrix.length,
    matrix,
    contrast,
    notes: [
      "Prototype only; real Electron/browser/backend behavior is not exercised.",
    ],
  };
  await writeFile(
    `${root}validation.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: checks.length,
        layouts: matrix.length,
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
