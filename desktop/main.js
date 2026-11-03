/* PartyBooth desktop (Windows) — Electron main process */
'use strict';
const { app, BrowserWindow, ipcMain, dialog, session, shell, Menu, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { sendMail } = require('./smtp');

const APP_DIR = path.join(__dirname, 'app');
const IMG_RE = /\.(jpe?g|png|webp)$/i;
let win = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 720, minHeight: 540, show: false,
    backgroundColor: '#1D1B2E', autoHideMenuBar: true, title: 'PartyBooth',
    icon: path.join(APP_DIR, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(APP_DIR, 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    if (input.control && input.shift && (input.key === 'Q' || input.key === 'q')) { e.preventDefault(); app.quit(); }
    if (input.control && input.shift && (input.key === 'I' || input.key === 'i')) win.webContents.toggleDevTools();
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  const allowed = ['media', 'fullscreen', 'clipboard-sanitized-write', 'fileSystem', 'window-management'];
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allowed.includes(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allowed.includes(permission));
  powerSaveBlocker.start('prevent-display-sleep');
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ---------------- helpers ---------------- */
const toBuf = d => Buffer.isBuffer(d) ? d : Buffer.from(d instanceof ArrayBuffer ? new Uint8Array(d) : d);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function safeName(n) { return String(n || 'photo.jpg').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120); }
function eventDir(folder, event) {
  return folder && folder.trim() ? folder : path.join(app.getPath('pictures'), 'PartyBooth', safeName(event || 'party'));
}
function httpGet(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), type: res.headers['content-type'] || '' }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}
function dccUrl(host, p) { return `http://${String(host || '127.0.0.1:5513').replace(/^https?:\/\//, '').replace(/\/$/, '')}${p}`; }

/* ---------------- printing ---------------- */
ipcMain.handle('printers', async () => {
  if (!win) return [];
  try { return (await win.webContents.getPrintersAsync()).map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault })); } catch (e) { return []; }
});

ipcMain.handle('print', async (e, o) => {
  const w = Number(o.widthIn) || 4, h = Number(o.heightIn) || 6;
  const landscape = w > h;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${w}in ${h}in;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:${w}in;height:${h}in;object-fit:contain}</style></head><body><img src="${o.image}"></body></html>`;
  const tmp = path.join(app.getPath('temp'), `partybooth-print-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const pw = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await pw.loadFile(tmp);
    await pw.webContents.executeJavaScript('new Promise(r => { const i = document.images[0]; if (i.complete) r(); else i.onload = r; })');
    const silent = !!o.silent && !!o.printer;
    const opts = {
      silent, printBackground: true, copies: Math.max(1, Number(o.copies) || 1),
      margins: { marginType: 'none' }, landscape,
      pageSize: { width: Math.round(Math.min(w, h) * 25400), height: Math.round(Math.max(w, h) * 25400) },
    };
    if (o.printer) opts.deviceName = o.printer;
    return await new Promise(res => pw.webContents.print(opts, (ok, reason) => res({ ok, error: ok ? null : (reason === 'cancelled' ? 'Printing was cancelled.' : reason || 'Printer error') })));
  } catch (err) { return { ok: false, error: err.message }; }
  finally { setTimeout(() => { try { pw.destroy(); } catch (e2) { /* ignore */ } fs.unlink(tmp, () => {}); }, 2000); }
});

/* ---------------- email ---------------- */
ipcMain.handle('email', async (e, o) => sendMail(o));

/* ---------------- files ---------------- */
ipcMain.handle('pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('saveAs', async (e, o) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('pictures'), safeName(o.name)) });
  if (r.canceled || !r.filePath) return { saved: false };
  fs.writeFileSync(r.filePath, toBuf(o.data));
  return { saved: true, path: r.filePath };
});
ipcMain.handle('saveToFolder', async (e, o) => {
  const dir = eventDir(o.folder, o.event);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, safeName(o.name));
  fs.writeFileSync(p, toBuf(o.data));
  return { path: p };
});
ipcMain.handle('openFolder', async (e, o) => {
  const dir = eventDir(o && o.folder, o && o.event);
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});

/* ---------------- DSLR hot folder ---------------- */
const snapshots = new Map();
function listImages(folder) {
  try { return fs.readdirSync(folder).filter(n => IMG_RE.test(n)); } catch (e) { return null; }
}
ipcMain.handle('hotfolderArm', async (e, o) => {
  const names = listImages(o.folder);
  if (!names) throw new Error(`Cannot open the camera folder: ${o.folder}`);
  snapshots.set(o.folder, new Set(names));
  return true;
});
ipcMain.handle('hotfolderWait', async (e, o) => {
  const folder = o.folder; const seen = snapshots.get(folder) || new Set(listImages(folder) || []);
  const t0 = Date.now(); const timeout = Number(o.timeoutMs) || 20000;
  while (Date.now() - t0 < timeout) {
    const names = listImages(folder) || [];
    const fresh = names.filter(n => !seen.has(n));
    if (fresh.length) {
      // newest first
      fresh.sort((a, b) => fs.statSync(path.join(folder, b)).mtimeMs - fs.statSync(path.join(folder, a)).mtimeMs);
      const p = path.join(folder, fresh[0]);
      let last = -1;
      for (let i = 0; i < 60; i++) { // wait for the file to finish writing
        let size = 0; try { size = fs.statSync(p).size; } catch (er) { /* not ready */ }
        if (size > 0 && size === last) break;
        last = size; await sleep(200);
      }
      fresh.forEach(n => seen.add(n)); snapshots.set(folder, seen);
      return { name: fresh[0], data: fs.readFileSync(p) };
    }
    await sleep(250);
  }
  return { error: 'No new photo arrived in the camera folder. Check the tethering app is saving JPEGs there.' };
});

/* ---------------- digiCamControl ---------------- */
ipcMain.handle('dccStatus', async (e, o) => {
  try {
    const r = await httpGet(dccUrl(o.host, '/?slc=list&param1=cameras&param2='), 3000);
    const txt = r.body.toString('utf8').trim();
    return { ok: r.status === 200, camera: txt && txt.length < 80 ? txt.replace(/[\r\n]+/g, ', ') : '' };
  } catch (err) { return { ok: false, error: err.code === 'ECONNREFUSED' ? 'digiCamControl is not running or its web server is off.' : err.message }; }
});
ipcMain.handle('dccLiveView', async (e, o) => {
  try { await httpGet(dccUrl(o.host, `/?CMD=${o.on ? 'LiveViewWnd_Show' : 'LiveViewWnd_Hide'}`), 3000); return true; } catch (err) { return false; }
});
ipcMain.handle('dccFrame', async (e, o) => {
  try { const r = await httpGet(dccUrl(o.host, `/liveview.jpg?t=${Date.now()}`), 1500); return r.status === 200 ? r.body : null; } catch (err) { return null; }
});
async function lastCaptured(host) {
  const r = await httpGet(dccUrl(host, '/?slc=get&param1=lastcaptured&param2='), 3000);
  return path.basename(r.body.toString('utf8').trim().replace(/\\/g, '/'));
}
ipcMain.handle('dccCapture', async (e, o) => {
  const host = o.host; const timeout = Number(o.timeoutMs) || 20000;
  try {
    let before = ''; try { before = await lastCaptured(host); } catch (er) { /* first shot */ }
    const trig = await httpGet(dccUrl(host, '/?slc=capture&param1=&param2='), 8000);
    if (trig.status !== 200) return { error: `digiCamControl answered ${trig.status} to the capture request.` };
    const t0 = Date.now(); let sawBusy = false;
    while (Date.now() - t0 < timeout) {
      await sleep(250);
      let name = ''; try { name = await lastCaptured(host); } catch (er) { continue; }
      if (!name || name === '-') { sawBusy = true; continue; }
      if (name !== before || (sawBusy && Date.now() - t0 > 600)) {
        for (let i = 0; i < 20; i++) {
          const img = await httpGet(dccUrl(host, `/image/${encodeURIComponent(name)}`), 15000).catch(() => null);
          if (img && img.status === 200 && img.body.length > 1000) return { name, data: img.body };
          await sleep(250);
        }
        return { error: `The camera took ${name} but the booth could not download it.` };
      }
    }
    return { error: 'The camera did not take a photo. Check it is on, focused, and connected in digiCamControl.' };
  } catch (err) {
    return { error: err.code === 'ECONNREFUSED' ? 'digiCamControl is not running or its web server is off.' : err.message };
  }
});

/* ---------------- Phone download (QR code) ----------------
   A tiny web server on the local network. Each published photo gets an unguessable link,
   so guests only ever see their own photo. Nothing leaves the venue's Wi-Fi. */
const os = require('os');
const crypto = require('crypto');
let shareSrv = null; let sharePort = 0;
const shareDir = () => path.join(app.getPath('userData'), 'phone-share');
const TOKEN_RE = /^[A-Za-z0-9]{12}$/;
const escHtml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const [name, list] of Object.entries(nets)) {
    for (const a of list || []) {
      if (a.internal || (a.family !== 'IPv4' && a.family !== 4) || /^169\.254\./.test(a.address)) continue;
      const virtual = /vethernet|virtualbox|vmware|hyper-v|wsl|loopback|tailscale|zerotier|docker|vpn|tap|tun/i.test(name);
      const privateNet = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      out.push({ name, ip: a.address, score: (privateNet ? 2 : 0) + (virtual ? -3 : 0) + (/wi-?fi|wlan|wireless/i.test(name) ? 1 : 0) });
    }
  }
  return out.sort((x, y) => y.score - x.score).map(({ name, ip }) => ({ name, ip }));
}
function shareBase(host) {
  const ip = host || (lanAddresses()[0] || {}).ip || '127.0.0.1';
  return `http://${ip}:${sharePort}`;
}
function readMeta(token) {
  try { return JSON.parse(fs.readFileSync(path.join(shareDir(), token + '.json'), 'utf8')); } catch (e) { return null; }
}
function guestPage(token, meta) {
  const title = escHtml(meta.title || 'Your photo');
  const name = escHtml(meta.name);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{margin:0;min-height:100vh;background:#1D1B2E;color:#fff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center}
main{max-width:640px;margin:0 auto;padding:22px 16px 40px}h1{font-size:22px;margin:4px 0 14px;color:#FFC93C}
img{width:100%;height:auto;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);background:#fff;-webkit-touch-callout:default}
a.btn{display:block;margin:18px 0 10px;padding:16px;border-radius:14px;background:#FFC93C;color:#1D1B2E;font-weight:800;font-size:19px;text-decoration:none}
p{color:#c9c6dd;line-height:1.5;font-size:15px;margin:6px 0}</style></head><body><main>
<h1>${title}</h1><img src="/f/${token}" alt="Your photo">
<a class="btn" href="/f/${token}?dl=1" download="${name}">Save to my phone</a>
<p><b>iPhone:</b> press and hold the photo, then tap <b>Save to Photos</b>.</p>
<p><b>Android:</b> tap the button above, or press and hold the photo and choose <b>Download image</b>.</p>
</main></body></html>`;
}
function handleShare(req, res) {
  const u = new URL(req.url, 'http://booth');
  const send = (code, type, body, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra || {})); res.end(body); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain', 'Not allowed');
  let m = u.pathname.match(/^\/p\/([A-Za-z0-9]+)\/?$/);
  if (m && TOKEN_RE.test(m[1])) {
    const meta = readMeta(m[1]);
    return meta ? send(200, 'text/html; charset=utf-8', guestPage(m[1], meta)) : send(404, 'text/html; charset=utf-8', '<p style="font:18px system-ui;padding:30px">This photo is no longer on the booth.</p>');
  }
  m = u.pathname.match(/^\/f\/([A-Za-z0-9]+)\/?$/);
  if (m && TOKEN_RE.test(m[1])) {
    const meta = readMeta(m[1]);
    const file = meta && path.join(shareDir(), m[1] + '.bin');
    if (!meta || !fs.existsSync(file)) return send(404, 'text/plain', 'Not found');
    const disp = `${u.searchParams.get('dl') ? 'attachment' : 'inline'}; filename="${String(meta.name).replace(/[^\w.\-]+/g, '_')}"`;
    return send(200, meta.mime || 'image/jpeg', fs.readFileSync(file), { 'Content-Disposition': disp });
  }
  if (u.pathname === '/') return send(200, 'text/html; charset=utf-8', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px system-ui;background:#1D1B2E;color:#fff;text-align:center;padding:40px 20px"><h2 style="color:#FFC93C">PartyBooth is connected</h2><p>Scan the QR code on the booth screen to get your photo.</p></body>');
  return send(404, 'text/plain', 'Not found');
}
function cleanShareDir(days = 14) {
  try {
    const cutoff = Date.now() - days * 864e5;
    for (const n of fs.readdirSync(shareDir())) { const p = path.join(shareDir(), n); if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); }
  } catch (e) { /* folder not there yet */ }
}
async function shareStop() {
  if (!shareSrv) return;
  const s = shareSrv; shareSrv = null; sharePort = 0;
  await new Promise(r => s.close(() => r()));
}
ipcMain.handle('shareStart', async (e, o) => {
  const port = Math.min(65535, Math.max(1024, Number(o && o.port) || 8090));
  if (shareSrv && sharePort === port) return { ok: true, port, addresses: lanAddresses(), url: shareBase(o && o.host) };
  await shareStop();
  fs.mkdirSync(shareDir(), { recursive: true }); cleanShareDir();
  const srv = http.createServer(handleShare);
  try {
    await new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(port, '0.0.0.0', resolve); });
  } catch (err) {
    return { ok: false, error: err.code === 'EADDRINUSE' ? `Port ${port} is already used by another program. Pick another port.` : err.message };
  }
  srv.on('error', () => {});
  shareSrv = srv; sharePort = port;
  return { ok: true, port, addresses: lanAddresses(), url: shareBase(o && o.host) };
});
ipcMain.handle('shareStop', async () => { await shareStop(); return true; });
ipcMain.handle('shareStatus', async (e, o) => ({ running: !!shareSrv, port: sharePort, addresses: lanAddresses(), url: shareSrv ? shareBase(o && o.host) : '' }));
ipcMain.handle('sharePublish', async (e, o) => {
  if (!shareSrv) return { error: 'Phone download is switched off.' };
  const token = crypto.randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).padEnd(12, 'x');
  fs.mkdirSync(shareDir(), { recursive: true });
  fs.writeFileSync(path.join(shareDir(), token + '.bin'), toBuf(o.data));
  fs.writeFileSync(path.join(shareDir(), token + '.json'), JSON.stringify({ name: safeName(o.name), mime: o.mime || 'image/jpeg', title: String(o.title || '').slice(0, 80), created: Date.now() }));
  return { url: `${shareBase(o.host)}/p/${token}` };
});

/* ---------------- window ---------------- */
ipcMain.handle('setKiosk', async (e, on) => { if (win) { win.setKiosk(!!on); if (!on) win.setFullScreen(false); } return true; });
ipcMain.handle('toggleFullscreen', async () => { if (win) win.setFullScreen(!win.isFullScreen()); return true; });
ipcMain.handle('quit', async () => { app.quit(); return true; });
