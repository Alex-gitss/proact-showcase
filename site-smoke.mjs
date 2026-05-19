import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "assets/images/favicon.svg",
  "assets/images/poster-proact-screen-recording-2026-05-19.jpg",
  "assets/images/poster-case-release.svg",
  "assets/images/poster-case-care.svg",
  "assets/images/poster-case-intake.svg",
  "assets/media/proact-screen-recording-2026-05-19.mp4",
  "assets/media/case-release-hotfix.mp4",
  "assets/media/case-care-coordination.mp4",
  "assets/media/case-intake-summary.mp4",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of requiredFiles) {
  assert(existsSync(path.join(siteRoot, file)), `Missing required file: ${file}`);
}

const html = readFileSync(path.join(siteRoot, "index.html"), "utf8");
const css = readFileSync(path.join(siteRoot, "styles.css"), "utf8");
const js = readFileSync(path.join(siteRoot, "app.js"), "utf8");
const publicSurface = `${html}\n${css}\n${js}`;

const expectedSections = [
  "top",
  "demo",
  "value",
  "comparison",
  "mechanism",
  "safety",
  "evaluation",
  "faq",
  "cta",
];

let previousIndex = -1;
for (const section of expectedSections) {
  const currentIndex = html.indexOf(`id="${section}"`);
  assert(currentIndex >= 0, `Missing section: ${section}`);
  assert(currentIndex > previousIndex, `Section order is incorrect at: ${section}`);
  previousIndex = currentIndex;
}

const expectedText = [
  "把智能体的等待时间变成可验证的下一步准备",
  "空闲窗口示例 trace（虚构）",
  "4 个原型流程 demo",
  "虚构人物、组织和合成事实表",
  "不代表线上生产系统效果",
  "主动交付不等于自动执行",
  "Push",
  "Queue",
  "Drop",
  "如何评测主动智能体是否真的有用？",
  "闭世界虚构场景",
  "隐藏标注",
  "打扰成本",
];

for (const text of expectedText) {
  assert(html.includes(text), `Expected text not found: ${text}`);
}

for (const anchor of [
  "#demo",
  "#safety",
  "#evaluation",
  "#value",
  "#comparison",
  "#mechanism",
  "#faq",
]) {
  assert(html.includes(`href="${anchor}"`), `Expected CTA or nav anchor not found: ${anchor}`);
}

assert(!html.includes("section--paper"), "Value and evaluation sections should not use the light paper treatment");
assert(
  html.includes('class="section section--soft" id="value"'),
  "Value section should use the dark soft band treatment",
);
assert(
  html.includes('class="section section--soft" id="evaluation"'),
  "Evaluation section should use the dark soft band treatment",
);
assert(css.includes(".section--soft"), "Stylesheet should define the dark soft band treatment");
assert(!css.includes("background: var(--paper);"), "Stylesheet should not use the light paper section background");

const idMatches = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
const ids = new Set(idMatches);
const hrefMatches = Array.from(html.matchAll(/\shref="#([^"]+)"/g), (match) => match[1]);
for (const target of hrefMatches) {
  assert(ids.has(target), `Anchor target missing: #${target}`);
}

const forbiddenText = [
  ["演示视频", "预留位"].join(""),
  ["Reserved media", " frame"].join(""),
  ["Mock interactive", " scenarios"].join(""),
  ["静态 research", " demo page"].join(""),
  ["实验结果", " dashboard"].join(""),
  ["接入真实", " ProAct backend"].join(""),
  ["Road", "map"].join(""),
  ["查看", "实验结果"].join(""),
  ["Live idle", " window"].join(""),
  ["Search", " now"].join(""),
  ["Store", " only"].join(""),
  ["Demo", " Video"].join(""),
  ["T100", " 降低"].join(""),
  ["User Effort", " 降低"].join(""),
  ["Hallucination", " Rate"].join(""),
  ["MemBench Reflective", " Accuracy"].join(""),
  "-14.8%",
  "-11.7%",
  "-28.1%",
  "href=\"#\"",
];

for (const text of forbiddenText) {
  assert(!publicSurface.includes(text), `Forbidden public content found: ${text}`);
}

assert((html.match(/<video\b/g) ?? []).length === 4, "Expected exactly four demo videos");
assert((html.match(/class="demo-card"/g) ?? []).length === 4, "Expected exactly four demo cards");
assert(!/https?:\/\//.test(html), "Page should not depend on external network resources");
assert(!/word-break:\s*break-all/.test(css), "CSS must not force ugly English letter breaking");
assert(css.includes("prefers-reduced-motion"), "CSS should support reduced motion");
assert(js.includes("data-theme"), "JavaScript should keep theme switching behavior");

const localAssetPattern = /\b(?:src|href|poster)="([^"]+)"/g;
for (const match of html.matchAll(localAssetPattern)) {
  const assetPath = match[1];
  if (assetPath.startsWith("#") || assetPath === "" || assetPath.startsWith("data:")) {
    continue;
  }
  assert(existsSync(path.join(siteRoot, assetPath)), `Referenced local asset does not exist: ${assetPath}`);
}

async function checkWithPlaywright(fileUrl) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(fileUrl);
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => element.scrollWidth > viewportWidth + 1)
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        scrollWidth: element.scrollWidth,
      }));
    return { documentWidth, viewportWidth, offenders };
  });
  await browser.close();
  assert(
    overflow.documentWidth <= overflow.viewportWidth + 1,
    `390px viewport has horizontal overflow: ${JSON.stringify(overflow)}`,
  );
}

async function checkWithChrome(fileUrl) {
  const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!existsSync(chromePath) || typeof WebSocket === "undefined") {
    console.warn("site-smoke: no browser automation available; skipped browser overflow check");
    return;
  }

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "proact-smoke-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--user-data-dir=${userDataDir}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  try {
    let browserWsUrl;
    try {
      browserWsUrl = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Chrome DevTools endpoint did not start")), 8000);
        chrome.stderr.setEncoding("utf8");
        chrome.stderr.on("data", (chunk) => {
          const match = chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/);
          if (match) {
            clearTimeout(timeout);
            resolve(match[1]);
          }
        });
        chrome.once("error", reject);
        chrome.once("exit", (code) => {
          if (code !== null && code !== 0) {
            clearTimeout(timeout);
            reject(new Error(`Chrome exited early with code ${code}`));
          }
        });
      });
    } catch (error) {
      console.warn(`site-smoke: Chrome overflow check skipped (${error.message})`);
      return;
    }

    const ws = new WebSocket(browserWsUrl);
    const pending = new Map();
    const eventWaiters = [];
    let nextId = 1;

    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
        return;
      }
      for (const waiter of [...eventWaiters]) {
        if (waiter.predicate(message)) {
          eventWaiters.splice(eventWaiters.indexOf(waiter), 1);
          waiter.resolve(message);
        }
      }
    });

    function send(method, params = {}, sessionId) {
      const id = nextId++;
      const payload = { id, method, params };
      if (sessionId) {
        payload.sessionId = sessionId;
      }
      ws.send(JSON.stringify(payload));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    }

    function waitForEvent(predicate, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        eventWaiters.push(waiter);
        setTimeout(() => {
          const index = eventWaiters.indexOf(waiter);
          if (index >= 0) {
            eventWaiters.splice(index, 1);
            reject(new Error("Timed out waiting for Chrome event"));
          }
        }, timeoutMs);
      });
    }

    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    }, sessionId);
    const loadEvent = waitForEvent((message) => (
      message.sessionId === sessionId && message.method === "Page.loadEventFired"
    ));
    await send("Page.navigate", { url: fileUrl }, sessionId);
    await loadEvent;

    const result = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const viewportWidth = window.innerWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const demoTop = document.querySelector("#demo")?.getBoundingClientRect().top ?? null;
        const offenders = Array.from(document.body.querySelectorAll("*"))
          .filter((element) => element.scrollWidth > viewportWidth + 1)
          .slice(0, 8)
          .map((element) => ({
            tag: element.tagName,
            className: String(element.className || ""),
            scrollWidth: element.scrollWidth
          }));
        return { viewportWidth, documentWidth, demoTop, offenders };
      })()`,
    }, sessionId);

    const overflow = result.result.value;
    assert(
      overflow.documentWidth <= overflow.viewportWidth + 1,
      `390px viewport has horizontal overflow: ${JSON.stringify(overflow)}`,
    );
    assert(
      overflow.demoTop !== null && overflow.demoTop < 900,
      `Demo section should appear near the first mobile viewport: ${JSON.stringify(overflow)}`,
    );
    if (process.env.PROACT_MOBILE_SCREENSHOT) {
      const screenshot = await send("Page.captureScreenshot", {
        captureBeyondViewport: false,
        format: "png",
      }, sessionId);
      await writeFile(process.env.PROACT_MOBILE_SCREENSHOT, Buffer.from(screenshot.data, "base64"));
    }
    await send("Browser.close").catch(() => {});
    ws.close();
  } finally {
    if (!chrome.killed) {
      chrome.kill("SIGTERM");
    }
    await rm(userDataDir, { recursive: true, force: true });
  }
}

const fileUrl = pathToFileURL(path.join(siteRoot, "index.html")).href;

try {
  await checkWithPlaywright(fileUrl);
} catch (error) {
  if (error?.code === "ERR_MODULE_NOT_FOUND") {
    await checkWithChrome(fileUrl);
  } else {
    throw error;
  }
}

console.log("site-smoke: ok");
