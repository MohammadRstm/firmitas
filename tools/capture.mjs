// Captures the sample portfolio pages in tools/mock-sites.html to assets/showcase/*.webp.
// Needs Node 22+ and Chrome. Run from the repository root:  node tools/capture.mjs
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve("assets/showcase");
const SOURCE = pathToFileURL(resolve("tools/mock-sites.html")).href;
const PAGES = ["home", "projects", "project", "studio"];
const PORT = 9333;

mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "shots-"))}`,
  "--window-size=1440,900", "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

try {
  const ws = new WebSocket(await target());
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const name of PAGES) {
    await send("Page.navigate", { url: `${SOURCE}?p=${name}` });
    await sleep(1500);
    await evalJs("document.fonts.ready.then(() => new Promise(r => setTimeout(r, 600)))");
    const h = (await evalJs("Math.min(document.documentElement.scrollHeight, 3600)")).result.value;
    const shot = await send("Page.captureScreenshot", { format: "webp", quality: 84, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: h, scale: 1 } });
    writeFileSync(join(OUT, `${name}.webp`), Buffer.from(shot.data, "base64"));
    console.log(name, h);
  }
  ws.close();
} finally {
  chrome.kill();
}
