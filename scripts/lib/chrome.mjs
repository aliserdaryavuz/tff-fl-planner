// Oyunun API'si Keycloak ile korunuyor ve giriş Google hesabıyla yapılıyor;
// yani şifreyle programatik giriş yok. Çözüm: projeye ayrılmış kalıcı bir
// Chrome profilinde bir kez giriş yapılır, betikler o tarayıcıya CDP
// (Chrome DevTools Protocol) ile bağlanıp istekleri sayfa bağlamında koşturur.
// Çerezler tarayıcının kendi kasasında kalır; token hiçbir yere yazılmaz.
//
// Kullanım:
//   const chrome = await connect();           // varsa bağlanır, yoksa açar
//   const r = await chrome.json("players");   // /api/backend/players
//   await chrome.close();
//
// İlk giriş için: node scripts/chrome-login.mjs

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const SITE = "https://tfffantezilig.com";
export const DEFAULT_PORT = Number(process.env.TFF_CDP_PORT ?? 9222);

/** Ayrı profil: kullanıcının günlük Chrome'una hiç dokunulmaz. */
export const PROFILE_DIR = resolve(
  process.env.LOCALAPPDATA ?? process.env.HOME ?? ".",
  "tff-fl-planner/chrome-profile",
);

const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Port açılana kadar bekler. */
async function waitForPort(port, seconds = 30) {
  for (let i = 0; i < seconds * 2; i++) {
    const v = await probe(port);
    if (v) return v;
    await sleep(500);
  }
  return null;
}

/**
 * Çalışan tarayıcıya bağlanır; yoksa (`launch`) ayrılmış profille açar.
 * `headless` yalnız yeni açarken geçerli: oturum profilde duruyorsa görünmez
 * pencere yeter, giriş gerekiyorsa `chrome-login.mjs` görünür pencere açar.
 */
export async function connect({
  port = DEFAULT_PORT,
  launch = true,
  headless = true,
  url = SITE,
} = {}) {
  let child = null;
  let version = await probe(port);

  if (!version) {
    if (!launch) throw new Error(`Chrome ${port} portunda bulunamadı`);
    mkdirSync(PROFILE_DIR, { recursive: true });
    const flags = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate",
    ];
    if (headless) flags.push("--headless=new", "--disable-gpu");
    flags.push("about:blank");
    child = spawn(CHROME, flags, { stdio: "ignore" });
    version = await waitForPort(port);
    if (!version) throw new Error("Chrome hata ayıklama portu açılmadı");
  }

  // Kendi sekmemizi açarız: kullanıcının sekmelerine dokunma.
  const tab = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
      method: "PUT",
    })
  ).json();

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", () => fail(new Error("CDP bağlantısı kurulamadı")), {
      once: true,
    });
  });

  let nextId = 1;
  const pending = new Map();
  const events = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method) {
      for (const cb of events.get(msg.method) ?? []) cb(msg.params);
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  });
  const on = (method, cb) => events.set(method, [...(events.get(method) ?? []), cb]);

  /** Yanıt gelmezse betik takılmasın. */
  const send = (method, params = {}, timeout = 60_000) =>
    new Promise((ok, fail) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        fail(new Error(`CDP zaman aşımı: ${method}`));
      }, timeout);
      pending.set(id, {
        resolve: (v) => (clearTimeout(timer), ok(v)),
        reject: (e) => (clearTimeout(timer), fail(e)),
      });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  /** Sayfayı yükle; istekler bu origin'de koşacak. */
  async function navigate(target) {
    const loaded = new Promise((r) => on("Page.loadEventFired", r));
    await send("Page.navigate", { url: target });
    await Promise.race([loaded, sleep(25_000)]);
    await sleep(800);
  }
  await navigate(url);

  /** Sayfa bağlamında fetch: çerezler kendiliğinden gider. */
  async function raw(target, init = {}) {
    const expr = `
      (async () => {
        try {
          const r = await fetch(${JSON.stringify(target)}, {
            credentials: "include",
            headers: { accept: "application/json", ...${JSON.stringify(init.headers ?? {})} },
            ${init.method ? `method: ${JSON.stringify(init.method)},` : ""}
            ${init.body ? `body: ${JSON.stringify(init.body)},` : ""}
          });
          const t = await r.text();
          return JSON.stringify({ status: r.status, body: t });
        } catch (e) {
          return JSON.stringify({ status: 0, body: "", error: String(e) });
        }
      })()`;
    const res = await send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    const out = JSON.parse(res.result.value);
    let json = null;
    try {
      json = JSON.parse(out.body);
    } catch {
      // JSON değil
    }
    return { ...out, json };
  }

  return {
    version,
    /** `/api/backend/<yol>`; mutlak URL de kabul eder. */
    json: (path, init) =>
      raw(path.startsWith("http") ? path : `${SITE}/api/backend/${path.replace(/^\/+/, "")}`, init),
    raw,
    navigate,
    /** Sitenin çerezleri (değerler değil, yalnız ad/alan/süre). */
    async cookieNames() {
      const { cookies } = await send("Network.getAllCookies");
      return cookies
        .filter((c) => c.domain.includes("tfffantezilig"))
        .map((c) => ({ name: c.name, domain: c.domain, httpOnly: c.httpOnly }));
    },
    /** Giriş yapılmış mı: kullanıcı uç noktası 200 dönüyor mu. */
    async loggedIn() {
      const r = await raw(`${SITE}/api/backend/user/me`);
      return r.status === 200;
    },
    async close({ quit = false } = {}) {
      ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`).catch(() => {});
      if (quit && child) child.kill();
    },
  };
}
