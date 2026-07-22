import { test as base, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = resolve(here, "../../apps/extension/.output/chrome-mv3");

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      // headless: false + "--headless=new" (not headless: true) is deliberate:
      // headless: true makes Playwright launch Chromium's headless-shell binary,
      // which has no extension support at all. Full Chrome driven into new-headless
      // mode via the arg is what actually loads --load-extension.
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        "--headless=new",
      ],
    });
    await use(context);
    await context.close();
  },
});
export const expect = test.expect;
