/* PartyBooth — shared utilities: DOM, storage, zip, sound, toasts, modals, confetti */
'use strict';
window.PB = window.PB || {};

(function (PB) {
  PB.native = window.boothNative || null;          // present only in the Windows desktop app
  PB.isDesktop = !!PB.native;
  PB.isTouch = matchMedia('(pointer: coarse)').matches;

  PB.$ = (sel, root) => (root || document).querySelector(sel);
  PB.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** el('div', {class:'x', onclick: fn}, [children|string]) */
  PB.el = function (tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    }
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c === null || c === undefined || c === false) return;
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return n;
  };

  PB.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  PB.sleep = ms => new Promise(r => setTimeout(r, ms));
  PB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PB.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  PB.loadImage = function (src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not load image'));
      img.src = src;
    });
  };
  const imgCache = new Map();
  PB.cachedImage = function (src) {
    if (!src) return Promise.resolve(null);
    if (!imgCache.has(src)) {
      const p = PB.loadImage(src).catch(e => { imgCache.delete(src); throw e; });
      imgCache.set(src, p);
    }
    return imgCache.get(src);
  };

  PB.blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  PB.fileToText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
  PB.dataURLToBlob = function (url) {
    const [head, b64] = url.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  };
  PB.canvasToBlob = (canvas, type = 'image/jpeg', q = 0.92) => new Promise((res, rej) => {
    if (canvas.toBlob) canvas.toBlob(b => b ? res(b) : rej(new Error('Encoding failed')), type, q);
    else res(PB.dataURLToBlob(canvas.toDataURL(type, q)));
  });
  PB.arrayBufferToBase64 = function (buf) {
    const u8 = new Uint8Array(buf); let s = ''; const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  };
  PB.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /** Pick a file with the hidden input. accept: '.json,image/*' */
  PB.pickFile = function (accept, opts = {}) {
    return new Promise(resolve => {
      const inp = document.getElementById('fileInput');
      inp.value = ''; inp.accept = accept || '';
      inp.multiple = !!opts.multiple;
      if (opts.capture) inp.setAttribute('capture', opts.capture); else inp.removeAttribute('capture');
      const done = () => { inp.onchange = null; resolve(opts.multiple ? Array.from(inp.files || []) : (inp.files && inp.files[0]) || null); };
      inp.onchange = done;
      inp.click();
    });
  };

  PB.dateLabel = function (fmt) {
    const d = new Date();
    if (fmt === 'long') return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  PB.fileStamp = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
  PB.slug = s => String(s || 'party').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'party';

  /* ---------------- IndexedDB ---------------- */
  const DB_NAME = 'partybooth', DB_VER = 1;
  let dbp = null;
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('No IndexedDB'));
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' }).createIndex('created', 'created');
        if (!db.objectStoreNames.contains('layouts')) db.createObjectStore('layouts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbp;
  }
  const memStore = { kv: new Map(), photos: new Map(), layouts: new Map(), assets: new Map() };
  let dbOK = true;
  async function tx(store, mode, fn) {
    if (!dbOK) return fn(null, memStore[store]);
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const t = db.transaction(store, mode); const s = t.objectStore(store);
        let out; const r = fn(s);
        if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    } catch (e) {
      console.warn('IndexedDB unavailable, using memory', e); dbOK = false;
      return fn(null, memStore[store]);
    }
  }
  PB.db = {
    get: (store, key) => tx(store, 'readonly', (s, m) => m ? m.get(key) : s.get(key)),
    put: (store, val, key) => tx(store, 'readwrite', (s, m) => m ? (m.set(key !== undefined ? key : val.id, val), undefined) : (key !== undefined ? s.put(val, key) : s.put(val))),
    del: (store, key) => tx(store, 'readwrite', (s, m) => m ? (m.delete(key), undefined) : s.delete(key)),
    all: (store) => tx(store, 'readonly', (s, m) => m ? Array.from(m.values()) : s.getAll()).then(r => r || []),
    clear: (store) => tx(store, 'readwrite', (s, m) => m ? (m.clear(), undefined) : s.clear()),
    count: (store) => tx(store, 'readonly', (s, m) => m ? m.size : s.count()),
  };

  /* ---------------- Settings ---------------- */
  PB.DEFAULTS = {
    eventName: 'Party Time', eventSub: '{date}', hashtag: '', welcome: 'Tap the big button, then strike a pose!',
    accent: '#FFC93C', startStyle: 'curtain', attractSlideshow: true,
    modes: { photo: true, gif: true },
    countdown: 5, countdownNext: 3, reviewSeconds: 1.4, posePrompts: true,
    poseList: [
      'Make your silliest face!', 'Everyone look surprised!', 'Strike a superhero pose!', 'Group hug!',
      'Pretend you just won the lottery', 'Blow a kiss', 'Show us your muscles', 'Bunny ears on someone!',
      'Look like a magazine cover', 'Pretend you saw a ghost', 'Peace signs everywhere', 'Squeeze in closer!',
      'Best dance move — go!', 'Big cheesy grin!', 'Everyone point at the camera', 'Act like rock stars',
      'Pretend it is really windy', 'Give your best evil laugh', 'Look at the person next to you', 'Crazy hair moment!'
    ].join('\n'),
    sounds: true, confetti: true, filters: true, stickers: true, draw: true, messages: true,
    defaultFilter: 'none', guestGallery: true, idleSeconds: 75,
    gifFrames: 6, gifDelay: 140, gifBoomerang: true, gifSize: 540,
    // camera
    camSource: 'webcam', camDevice: '', camRes: '1920x1080', mirrorPreview: true, mirrorPhoto: false, camRotate: 0,
    hotPreviewDevice: '', hotTimeout: 20, hotFolder: '', dccHost: '127.0.0.1:5513', dccPreview: true,
    greenScreen: false, gsColor: 'green', gsStrength: 50, gsBackdrop: 'bd-confetti', gsGuestPick: true,
    // layouts
    enabledLayouts: ['classic-strip', 'party-grid', 'scrapbook', 'polaroid', 'postcard'], defaultLayout: 'classic-strip',
    // printing
    printEnabled: true, paper: '4x6', printFit: 'contain', maxCopies: 4, autoPrint: false, autoPrintCopies: 1,
    printer: '', silentPrint: true,
    // email + share
    emailEnabled: true, shareEnabled: true,
    qrEnabled: true, qrPort: 8090, qrHost: '', qrWifiName: '', qrWifiPass: '',
    emailSubject: 'Your photo from {event}!',
    emailBody: 'Thanks for celebrating with us at {event}! Your photo is attached. {hashtag}',
    emailMethod: 'auto', relayUrl: '', relaySecret: '', fromName: 'PartyBooth',
    smtpHost: '', smtpPort: 465, smtpSecure: true, smtpUser: '', smtpPass: '', smtpFrom: '',
    // kiosk
    pin: '', keepAwake: true, keyTrigger: true, osk: 'auto',
    saveToFolder: true, saveFolder: '', kioskMode: false,
  };
  PB.settings = JSON.parse(JSON.stringify(PB.DEFAULTS));
  PB.loadSettings = async function () {
    try {
      const s = await PB.db.get('kv', 'settings');
      if (s) PB.settings = Object.assign(JSON.parse(JSON.stringify(PB.DEFAULTS)), s, { modes: Object.assign({}, PB.DEFAULTS.modes, s.modes || {}) });
    } catch (e) { console.warn(e); }
    return PB.settings;
  };
  let saveT = null;
  PB.saveSettings = function () {
    clearTimeout(saveT);
    saveT = setTimeout(() => PB.db.put('kv', JSON.parse(JSON.stringify(PB.settings)), 'settings').catch(console.warn), 150);
  };
  /** Fill {event} {date} {hashtag} {message} placeholders */
  PB.fill = function (str, extra) {
    const s = PB.settings;
    const map = Object.assign({ event: s.eventName || '', date: PB.dateLabel('long'), hashtag: s.hashtag || '', message: '' }, extra || {});
    return String(str || '').replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
  };

  /* ---------------- ZIP (store, no compression) ---------------- */
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  PB.crc32 = function (u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /** files: [{name, data: Uint8Array|Blob|string}] -> Blob */
  PB.makeZip = async function (files) {
    const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const d = new Date(); const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      let data = f.data;
      if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
      else if (typeof data === 'string') data = enc.encode(data);
      const name = enc.encode(f.name); const crc = PB.crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  };

  /* ---------------- Save / download ---------------- */
  PB.download = async function (blob, filename) {
    if (PB.native && PB.native.saveAs) {
      const res = await PB.native.saveAs({ name: filename, data: await blob.arrayBuffer() });
      if (res && res.saved) PB.toast('Saved');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = PB.el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  /* ---------------- Sound (synthesized, no files) ---------------- */
  let actx = null;
  function ac() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  PB.sound = {
    unlock() { ac(); },
    beep(freq = 880, dur = 0.12, vol = 0.25) {
      if (!PB.settings.sounds) return; const a = ac(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur + 0.02);
    },
    shutter() {
      if (!PB.settings.sounds) return; const a = ac(); if (!a) return;
      const len = Math.floor(a.sampleRate * 0.18); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3) * (t < 0.08 || (t > 0.45 && t < 0.55) ? 1 : 0.35); }
      const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
      const g = a.createGain(); g.gain.value = 0.5; src.connect(f).connect(g).connect(a.destination); src.start();
    },
    tada() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => PB.sound.beep(f, 0.22, 0.18), i * 90)); },
  };

  /* ---------------- Toast ---------------- */
  let toastT = null;
  PB.toast = function (msg, isErr, ms) {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.toggle('err', !!isErr);
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || (isErr ? 4200 : 2600));
  };

  /* ---------------- Modals ---------------- */
  PB.modal = function (content, opts = {}) {
    const root = document.getElementById('modalRoot');
    const box = PB.el('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, content);
    const back = PB.el('div', { class: 'modal-back' }, box);
    let closed = false;
    const close = (v) => { if (closed) return; closed = true; back.remove(); document.removeEventListener('keydown', onKey); opts.onClose && opts.onClose(v); };
    const onKey = e => { if (e.key === 'Escape' && opts.dismissable !== false) close(); };
    if (opts.dismissable !== false) back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(back);
    const f = box.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
    return { close, box };
  };
  PB.confirm = function (title, text, okLabel = 'OK', danger) {
    return new Promise(res => {
      let m;
      const ok = PB.el('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { res(true); m.close(true); } }, okLabel);
      m = PB.modal([PB.el('h3', { text: title }), text ? PB.el('p', { text }) : null,
        PB.el('div', { class: 'modal-actions' }, [PB.el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), ok])],
        { onClose: v => { if (!v) res(false); } });
    });
  };
  PB.alert = function (title, text) {
    return new Promise(res => {
      let m; m = PB.modal([PB.el('h3', { text: title }), text ? PB.el('p', { text }) : null,
        PB.el('div', { class: 'modal-actions' }, PB.el('button', { class: 'btn primary', onclick: () => m.close() }, 'OK'))], { onClose: () => res() });
    });
  };
  /** PIN pad. Resolves true if correct (or no PIN set). */
  PB.askPin = function (title = 'Enter host PIN') {
    const pin = String(PB.settings.pin || '');
    if (!pin) return Promise.resolve(true);
    return new Promise(res => {
      let entered = ''; let m;
      const dots = PB.el('div', { class: 'pin-dots' });
      const draw = () => { dots.innerHTML = ''; for (let i = 0; i < Math.max(pin.length, 4); i++) dots.appendChild(PB.el('i', { class: i < entered.length ? 'on' : '' })); };
      const press = k => {
        if (k === '⌫') entered = entered.slice(0, -1);
        else if (k === 'C') entered = '';
        else entered += k;
        draw();
        if (entered.length >= pin.length) {
          if (entered === pin) { res(true); m.close(true); }
          else { dots.classList.remove('bad'); void dots.offsetWidth; dots.classList.add('bad'); entered = ''; setTimeout(draw, 300); }
        }
      };
      const pad = PB.el('div', { class: 'pinpad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => PB.el('button', { onclick: () => press(k), 'aria-label': k === '⌫' ? 'Delete' : k === 'C' ? 'Clear' : k }, k)));
      const onKey = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); };
      document.addEventListener('keydown', onKey);
      draw();
      m = PB.modal([PB.el('h3', { text: title, style: { textAlign: 'center' } }), dots, pad,
        PB.el('div', { class: 'modal-actions', style: { justifyContent: 'center' } }, PB.el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'))],
        { onClose: v => { document.removeEventListener('keydown', onKey); if (!v) res(false); } });
    });
  };

  /* ---------------- Confetti ---------------- */
  PB.confetti = function (ms = 2600) {
    if (!PB.settings.confetti || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.getElementById('confetti'); const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ['#FFC93C', '#C8203B', '#13968F', '#FFFFFF', '#6C5CE7', '#FF7AB6'];
    const P = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .55,
      vx: (Math.random() - .5) * 16, vy: -Math.random() * 18 - 8, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4,
      w: 8 + Math.random() * 8, h: 5 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const alpha = Math.max(0, 1 - (t - t0) / ms);
      for (const p of P) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (t - t0 < ms) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  };

  /* ---------------- Fonts ---------------- */
  PB.FONTS = {
    Display: "'Bungee', Impact, 'Arial Black', sans-serif",
    Rounded: "'Nunito', 'Segoe UI', 'Trebuchet MS', sans-serif",
    Script: "'Pacifico', 'Segoe Script', 'Brush Script MT', cursive",
    Elegant: "'Playfair Display', Georgia, 'Times New Roman', serif",
    Handwritten: "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive",
    Classic: "Georgia, 'Times New Roman', serif",
    Bold: "Impact, 'Arial Black', sans-serif",
  };
  PB.fontStack = name => PB.FONTS[name] || PB.FONTS.Rounded;
  PB.fontStyleFor = name => name === 'Elegant' ? 'italic ' : '';
  PB.ensureFonts = async function () {
    if (!document.fonts || !document.fonts.load) return;
    const loads = ["24px 'Bungee'", "800 24px 'Nunito'", "24px 'Pacifico'", "italic 700 24px 'Playfair Display'", "700 24px 'Caveat'"].map(f => document.fonts.load(f).catch(() => null));
    await Promise.race([Promise.all(loads), PB.sleep(2500)]);
  };
})(window.PB);
