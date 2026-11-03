/* PartyBooth — saving, printing, email, sharing, exports */
'use strict';
(function (PB) {
  const PAPERS = {
    '4x6': { w: 4, h: 6, label: '4×6 in (10×15 cm) photo paper' },
    '5x7': { w: 5, h: 7, label: '5×7 in (13×18 cm)' },
    '6x8': { w: 6, h: 8, label: '6×8 in (15×20 cm)' },
    'a6': { w: 4.13, h: 5.83, label: 'A6' },
    'letter': { w: 8.5, h: 11, label: 'US Letter' },
    'a4': { w: 8.27, h: 11.69, label: 'A4' },
  };
  const DPI = 300;

  /* ---------------- Gallery records ---------------- */
  /** rec: {id, created, kind, blob, thumb, layoutId, layoutName, width, height, prints, emails, message} */
  async function saveRecord(rec) {
    await PB.db.put('photos', rec);
    if (PB.native && PB.settings.saveToFolder && !rec.savedToDisk) {
      try {
        const r = await PB.native.saveToFolder({ folder: PB.settings.saveFolder, event: PB.slug(PB.settings.eventName), name: fileName(rec), data: await rec.blob.arrayBuffer() });
        if (r && r.path) { rec.savedToDisk = r.path; await PB.db.put('photos', rec); }
      } catch (e) { console.warn('save to folder failed', e); }
    }
    return rec;
  }
  function fileName(rec) {
    const d = new Date(rec.created); const p = n => String(n).padStart(2, '0');
    return `${PB.slug(PB.settings.eventName)}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${rec.id.slice(-4)}.${rec.kind === 'gif' ? 'gif' : 'jpg'}`;
  }

  /* ---------------- Printing ---------------- */
  /** How a card sits on paper. Returns {pageW, pageH (inches), twoUp} */
  function printPlan(card) {
    const paper = PAPERS[PB.settings.paper] || PAPERS['4x6'];
    const landscape = card.width > card.height * 1.05;
    const strip = card.height / card.width > 2.4; // 2x6-style strip
    let pageW = paper.w, pageH = paper.h;
    if (landscape) { pageW = paper.h; pageH = paper.w; }
    return { pageW, pageH, twoUp: strip && !landscape };
  }
  /** Build a print-ready page image at 300 dpi. */
  function pageCanvas(cardCanvas) {
    const plan = printPlan(cardCanvas);
    const W = Math.round(plan.pageW * DPI), H = Math.round(plan.pageH * DPI);
    const c = PB.makeCanvas(W, H); const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    const place = PB.settings.printFit === 'cover' ? PB.compose.drawCover : PB.compose.drawContain;
    if (plan.twoUp) { place(ctx, cardCanvas, 0, 0, W / 2, H); place(ctx, cardCanvas, W / 2, 0, W / 2, H); }
    else place(ctx, cardCanvas, 0, 0, W, H);
    return { canvas: c, plan };
  }

  async function print(cardCanvas, copies = 1) {
    const { canvas, plan } = pageCanvas(cardCanvas);
    const url = canvas.toDataURL('image/jpeg', 0.95);
    if (PB.native && PB.native.print) {
      const res = await PB.native.print({
        image: url, widthIn: plan.pageW, heightIn: plan.pageH, copies,
        printer: PB.settings.printer || '', silent: !!PB.settings.silentPrint && !!PB.settings.printer,
      });
      if (!res || !res.ok) throw new Error((res && res.error) || 'The printer did not accept the job.');
      return true;
    }
    // Browser: print a hidden page sized exactly to the paper.
    let area = document.getElementById('printArea'); if (area) area.remove();
    let st = document.getElementById('printStyle'); if (st) st.remove();
    st = PB.el('style', { id: 'printStyle', text:
      `@page { size: ${plan.pageW}in ${plan.pageH}in; margin: 0; }
       #printArea { display: none; }
       @media print {
         html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
         body > *:not(#printArea) { display: none !important; }
         #printArea { display: block !important; }
         #printArea img { display: block; width: ${plan.pageW}in; height: ${plan.pageH}in; page-break-after: always; break-after: page; }
         #printArea img:last-child { page-break-after: auto; break-after: auto; }
       }` });
    area = PB.el('div', { id: 'printArea' });
    for (let i = 0; i < Math.max(1, copies); i++) area.appendChild(PB.el('img', { src: url, alt: '' }));
    document.head.appendChild(st); document.body.appendChild(area);
    await Promise.all(Array.from(area.querySelectorAll('img')).map(im => im.decode ? im.decode().catch(() => {}) : null));
    await PB.sleep(50);
    window.print();
    setTimeout(() => { area.remove(); st.remove(); }, 1500);
    return true;
  }

  /* ---------------- Email ---------------- */
  function emailMethod() {
    const S = PB.settings;
    if (S.emailMethod === 'queue') return 'queue';
    if (S.emailMethod === 'smtp' || (S.emailMethod === 'auto' && PB.native && S.smtpHost)) return PB.native && S.smtpHost ? 'smtp' : 'queue';
    if (S.emailMethod === 'relay' || (S.emailMethod === 'auto' && S.relayUrl)) return S.relayUrl ? 'relay' : 'queue';
    return 'queue';
  }
  PB.validEmail = e => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(String(e).trim());

  async function sendOne(rec, to) {
    const S = PB.settings; const method = emailMethod();
    const subject = PB.fill(S.emailSubject, { message: rec.message || '' });
    const body = PB.fill(S.emailBody, { message: rec.message || '' }).trim();
    if (method === 'queue') return { status: 'queued' };
    const data = PB.arrayBufferToBase64(await rec.blob.arrayBuffer());
    const filename = fileName(rec); const mime = rec.kind === 'gif' ? 'image/gif' : 'image/jpeg';
    if (method === 'smtp') {
      const r = await PB.native.sendEmail({
        smtp: { host: S.smtpHost, port: Number(S.smtpPort) || 465, secure: !!S.smtpSecure, user: S.smtpUser, pass: S.smtpPass },
        from: S.smtpFrom || S.smtpUser, fromName: S.fromName || S.eventName, to, subject, text: body,
        html: `<p style="font-family:Arial,sans-serif;font-size:16px">${PB.esc(body).replace(/\n/g, '<br>')}</p>`,
        attachments: [{ filename, contentType: mime, data }],
      });
      if (!r || !r.ok) throw new Error((r && r.error) || 'The mail server refused the message.');
      return { status: 'sent' };
    }
    // relay (e.g. Google Apps Script web app). The response is opaque, so a network success counts as sent.
    await fetch(S.relayUrl, {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: S.relaySecret, to, subject, body, fromName: S.fromName || S.eventName, filename, mimeType: mime, data }),
    });
    return { status: 'sent' };
  }

  /** Email a record to one or more addresses. Failures are queued for later. */
  async function email(rec, addresses) {
    rec.emails = rec.emails || [];
    const results = [];
    for (const to of addresses) {
      const entry = { to, at: Date.now(), status: 'queued' };
      try { Object.assign(entry, await sendOne(rec, to)); }
      catch (e) { entry.status = 'queued'; entry.error = String(e.message || e); }
      rec.emails.push(entry); results.push(entry);
    }
    await PB.db.put('photos', rec);
    return results;
  }

  async function queued() {
    const all = await PB.db.all('photos'); const out = [];
    all.forEach(r => (r.emails || []).forEach(e => { if (e.status === 'queued') out.push({ rec: r, entry: e }); }));
    return out;
  }
  async function sendQueued(onProgress) {
    if (emailMethod() === 'queue') throw new Error('Set up email sending first (SMTP in the desktop app, or the email relay).');
    const list = await queued(); let sent = 0, failed = 0; const touched = new Set();
    for (const { rec, entry } of list) {
      try { const r = await sendOne(rec, entry.to); entry.status = r.status; delete entry.error; if (r.status === 'sent') sent++; }
      catch (e) { entry.error = String(e.message || e); failed++; }
      touched.add(rec); onProgress && onProgress(sent + failed, list.length);
    }
    for (const r of touched) await PB.db.put('photos', r);
    return { sent, failed, total: list.length };
  }
  async function exportEmailList() {
    const all = (await PB.db.all('photos')).sort((a, b) => a.created - b.created);
    const files = []; const rows = [['email', 'photo_file', 'taken', 'status', 'message']];
    all.forEach(r => {
      if (!(r.emails || []).length) return;
      const fn = fileName(r); files.push({ name: 'photos/' + fn, data: r.blob });
      r.emails.forEach(e => rows.push([e.to, fn, new Date(r.created).toISOString(), e.status, r.message || '']));
    });
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    files.unshift({ name: 'email-list.csv', data: csv });
    return PB.makeZip(files);
  }

  /* ---------------- Share / save ---------------- */
  function canShareFiles() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) { return false; }
  }
  async function share(rec) {
    const name = fileName(rec);
    if (!PB.native && canShareFiles()) {
      const file = new File([rec.blob], name, { type: rec.blob.type || 'image/jpeg' });
      try { await navigator.share({ files: [file], title: PB.settings.eventName, text: PB.fill('{event} {hashtag}').trim() }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    await PB.download(rec.blob, name);
    return 'downloaded';
  }

  /* ---------------- Phone download (QR code, desktop app) ---------------- */
  const phoneOn = () => !!(PB.native && PB.native.shareStart && PB.settings.qrEnabled);
  let phoneState = { running: false, url: '', error: '' };
  async function startPhoneServer() {
    if (!PB.native || !PB.native.shareStart) return phoneState;
    if (!PB.settings.qrEnabled) { await PB.native.shareStop(); phoneState = { running: false, url: '', error: '' }; return phoneState; }
    const r = await PB.native.shareStart({ port: Number(PB.settings.qrPort) || 8090, host: PB.settings.qrHost || '' }).catch(e => ({ ok: false, error: e.message }));
    phoneState = r.ok ? { running: true, url: r.url, addresses: r.addresses || [], error: '' } : { running: false, url: '', error: r.error || 'Could not start' };
    return phoneState;
  }
  async function phoneLink(rec) {
    if (!phoneOn()) throw new Error('Phone download is switched off in Settings → Email & sharing.');
    if (rec._phoneUrl && rec._phoneBlob === rec.blob) return rec._phoneUrl;
    if (!phoneState.running) await startPhoneServer();
    if (!phoneState.running) throw new Error(phoneState.error || 'Phone download could not start.');
    const r = await PB.native.sharePublish({ data: await rec.blob.arrayBuffer(), name: fileName(rec), mime: rec.blob.type || (rec.kind === 'gif' ? 'image/gif' : 'image/jpeg'), title: PB.settings.eventName, host: PB.settings.qrHost || '' });
    if (!r || !r.url) throw new Error((r && r.error) || 'Could not prepare the download.');
    rec._phoneUrl = r.url; rec._phoneBlob = rec.blob;
    return r.url;
  }
  function wifiCode(name, pass) {
    const esc = s => String(s).replace(/([\\;,:"])/g, '\\$1');
    return pass ? `WIFI:T:WPA;S:${esc(name)};P:${esc(pass)};;` : `WIFI:T:nopass;S:${esc(name)};;`;
  }
  /** Show the scan-to-download popup for a gallery record. */
  async function showPhoneQR(rec) {
    let url;
    try { url = await phoneLink(rec); } catch (e) { PB.toast(e.message || String(e), true); return; }
    const S = PB.settings; const el = PB.el;
    const card = (canvas, step, text) => el('div', { class: 'qr-card' }, [canvas, el('div', { class: 'qr-step', text: step }), text ? el('div', { class: 'qr-sub', text }) : null]);
    const cards = [];
    if (S.qrWifiName && S.qrWifiPass) cards.push(card(PB.qr.canvas(wifiCode(S.qrWifiName, S.qrWifiPass), 480), '1. Join our Wi-Fi', S.qrWifiName));
    cards.push(card(PB.qr.canvas(url, 480), cards.length ? '2. Get your photo' : 'Scan with your phone camera', cards.length ? null : 'Your phone must be on the same Wi-Fi as the booth.'));
    let m;
    const wifiLine = S.qrWifiName && !S.qrWifiPass ? el('p', { class: 'qr-wifi', html: `First join the Wi-Fi <b>${PB.esc(S.qrWifiName)}</b>.` }) : null;
    m = PB.modal([
      el('h3', { text: 'Get it on your phone', style: { textAlign: 'center' } }),
      wifiLine,
      el('div', { class: 'qr-cards' }, cards),
      el('p', { class: 'qr-url', text: url }),
      el('div', { class: 'modal-actions', style: { justifyContent: 'center' } }, [el('button', { class: 'btn primary', onclick: () => m.close() }, 'Done')]),
    ], { wide: cards.length > 1 });
    return m;
  }

  async function exportAll() {
    const all = (await PB.db.all('photos')).sort((a, b) => a.created - b.created);
    if (!all.length) throw new Error('No photos yet.');
    return PB.makeZip(all.map(r => ({ name: fileName(r), data: r.blob })));
  }

  PB.output = { PAPERS, saveRecord, fileName, printPlan, pageCanvas, print, email, emailMethod, queued, sendQueued, exportEmailList, canShareFiles, share, exportAll,
    phoneOn, startPhoneServer, phoneLink, showPhoneQR, wifiCode, get phoneState() { return phoneState; } };
})(window.PB);
