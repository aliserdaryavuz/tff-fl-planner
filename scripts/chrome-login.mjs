// Oyuna bir kez giriş: projeye ayrılmış Chrome profilinde görünür bir pencere
// açar ve giriş tamamlanana kadar bekler. Giriş Google hesabıyla yapıldığı için
// bu adım elle; sonrası (fetch-game.mjs) otomatik.
//
//   node scripts/chrome-login.mjs [--timeout 300]
//
// Pencereyi kapatma: oturum çerezleri tarayıcı kapanınca düşebilir. Kapanırsa
// bu betiği yeniden çalıştır.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { connect, DEFAULT_PORT, PROFILE_DIR, SITE } from "./lib/chrome.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--timeout");
const TIMEOUT = Number(i >= 0 ? args[i + 1] : 300);
const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const log = (m) => process.stderr.write(`${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const running = await fetch(`http://127.0.0.1:${DEFAULT_PORT}/json/version`, {
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

if (!running) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  log(`Chrome açılıyor (profil: ${PROFILE_DIR})`);
  spawn(
    CHROME,
    [
      `--remote-debugging-port=${DEFAULT_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1100,900",
      `${SITE}/giris`,
    ],
    { stdio: "ignore", detached: true },
  ).unref();
  await sleep(4000);
}

const chrome = await connect({ launch: false });

/**
 * Önce sessiz deneme. Erişim belirteci (`kc_access_token`) birkaç günde düşüyor
 * ama Keycloak'ın tek oturum açma kaydı (`KEYCLOAK_SESSION`) çok daha uzun
 * yaşıyor; o duruyorsa OAuth akışını başlatmak hiçbir tıklama istemeden geri
 * dönüyor. 18.09.2026'da altı gün sonra bu şekilde geri girildi.
 *
 * Neden önemli: bu betik görünür bir pencere açıp tıklama bekliyor. Kullanıcı
 * makinenin başında değilse (uzaktan bağlıysa) o pencereye erişemez ve tek işe
 * yarayan yol budur. `/giris` sayfasını açmak yetmiyor — akış ancak Google
 * düğmesine basınca, yani bu adrese gidince başlıyor.
 */
let ok = await chrome.loggedIn();
if (!ok) {
  log("Sessiz giriş deneniyor (mevcut Google oturumu üzerinden)…");
  await chrome.navigate(`${SITE}/api/auth/social/google`);
  await sleep(9000);
  ok = await chrome.loggedIn();
  if (ok) log("Sessiz giriş başarılı; pencereye dokunmaya gerek kalmadı.");
}

if (!ok) {
  log("Açılan pencerede Google hesabınla giriş yap; giriş algılanınca devam edeceğim.");
  const started = Date.now();
  while ((Date.now() - started) / 1000 < TIMEOUT) {
    if (await chrome.loggedIn()) {
      ok = true;
      break;
    }
    await sleep(3000);
  }
}
await chrome.close();

if (!ok) {
  log(`giriş ${TIMEOUT} saniyede algılanmadı; pencere açık kaldı, tekrar dene.`);
  process.exit(1);
}
log("giriş algılandı. Sıradaki: node scripts/fetch-game.mjs");
log("Bu Chrome penceresini açık bırak; veri çekerken oturum oradan kullanılıyor.");
