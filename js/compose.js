/* PartyBooth — rendering cards: backgrounds, photo slots, filters, overlay, text, stickers, doodles; GIF frames; green screen */
'use strict';
(function (PB) {
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';

  /* ---------------- Filters ---------------- */
  const FILTERS = [
    { id: 'none', name: 'Original' },
    { id: 'pop', name: 'Pop', sat: 1.45, con: 1.1 },
    { id: 'bw', name: 'Black & white', gray: 1, con: 1.08 },
    { id: 'noir', name: 'Noir', gray: 1, con: 1.45, vig: 0.55 },
    { id: 'vintage', name: 'Vintage', sepia: 0.45, sat: 0.85, fade: 0.12, mul: [1.06, 1.0, 0.92], vig: 0.4 },
    { id: 'sepia', name: 'Sepia', sepia: 1, con: 1.05 },
    { id: 'warm', name: 'Golden hour', mul: [1.1, 1.02, 0.86], add: [8, 4, 0], sat: 1.1 },
    { id: 'cool', name: 'Ice', mul: [0.9, 1.0, 1.12], add: [0, 4, 12], sat: 0.95 },
    { id: 'dreamy', name: 'Dreamy', con: 0.86, bri: 1.08, mul: [1.05, 0.98, 1.04], add: [14, 6, 14], fade: 0.06 },
    { id: 'retro', name: 'Retro', mul: [1.12, 1.04, 0.8], add: [0, 0, 34], con: 1.15, sat: 0.9 },
    { id: 'comic', name: 'Comic', sat: 1.6, con: 1.2, post: 5 },
  ];
  function applyFilter(ctx, w, h, id) {
    const P = FILTERS.find(f => f.id === id);
    if (!P || id === 'none') return;
    const im = ctx.getImageData(0, 0, w, h); const d = im.data;
    const fadeLift = P.fade ? P.fade * 255 * 0.35 : 0, fadeMul = 1 - (P.fade || 0) * 0.35;
    const step = P.post ? 255 / (P.post - 1) : 0;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (P.gray) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = l; }
      if (P.sepia) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * P.sepia; g += (sg - g) * P.sepia; b += (sb - b) * P.sepia;
      }
      if (P.sat !== undefined) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = l + (r - l) * P.sat; g = l + (g - l) * P.sat; b = l + (b - l) * P.sat; }
      if (P.mul) { r *= P.mul[0]; g *= P.mul[1]; b *= P.mul[2]; }
      if (P.add) { r += P.add[0]; g += P.add[1]; b += P.add[2]; }
      if (P.con) { r = (r - 128) * P.con + 128; g = (g - 128) * P.con + 128; b = (b - 128) * P.con + 128; }
      if (P.bri) { r *= P.bri; g *= P.bri; b *= P.bri; }
      if (P.fade) { r = fadeLift + r * fadeMul; g = fadeLift + g * fadeMul; b = fadeLift + b * fadeMul; }
      if (step) { r = Math.round(r / step) * step; g = Math.round(g / step) * step; b = Math.round(b / step) * step; }
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(im, 0, 0);
    if (P.vig) {
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${P.vig})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
  }

  /* ---------------- Helpers ---------------- */
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function srcSize(src) { return { w: src.naturalWidth || src.videoWidth || src.width, h: src.naturalHeight || src.videoHeight || src.height }; }
  /** draw src covering the box (center crop) */
  function drawCover(ctx, src, x, y, w, h, focusY = 0.5) {
    const s = srcSize(src); if (!s.w || !s.h) return;
    const sc = Math.max(w / s.w, h / s.h); const cw = w / sc, ch = h / sc;
    const sx = (s.w - cw) / 2, sy = (s.h - ch) * focusY;
    ctx.drawImage(src, sx, sy, cw, ch, x, y, w, h);
  }
  function drawContain(ctx, src, x, y, w, h) {
    const s = srcSize(src); const sc = Math.min(w / s.w, h / s.h); const dw = s.w * sc, dh = s.h * sc;
    ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /** Photo cropped to slot size with filter applied; cached on the photo canvas. */
  function preparePhoto(photo, w, h, filter) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const key = `${filter}|${w}x${h}`;
    photo._pb = photo._pb || new Map();
    if (photo._pb.has(key)) return photo._pb.get(key);
    const c = PB.makeCanvas(w, h); const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    drawCover(ctx, photo, 0, 0, w, h, 0.42);
    applyFilter(ctx, w, h, filter);
    if (photo._pb.size > 24) photo._pb.clear();
    photo._pb.set(key, c);
    return c;
  }

  async function paintBackground(ctx, bg, W, H) {
    if (!bg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); return; }
    if (typeof bg === 'string' && bg.startsWith('data:')) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      try { drawCover(ctx, await PB.cachedImage(bg), 0, 0, W, H); } catch (e) { /* ignore */ }
      return;
    }
    if (typeof bg === 'object' && bg.gradient) {
      const a = ((bg.angle == null ? 180 : bg.angle) - 90) * Math.PI / 180; const len = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
      const cx = W / 2, cy = H / 2, dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      bg.gradient.forEach((col, i) => g.addColorStop(i / Math.max(1, bg.gradient.length - 1), col));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
    }
    ctx.fillStyle = String(bg); ctx.fillRect(0, 0, W, H);
  }

  function fitFont(ctx, text, t, s) {
    const style = PB.fontStyleFor(t.font); const fam = PB.fontStack(t.font);
    let size = t.size * s;
    const set = () => { ctx.font = `${style}${t.weight || 400} ${size}px ${fam}`; };
    set();
    if (t.maxWidth > 0) {
      const max = t.maxWidth * s; let guard = 0;
      while (ctx.measureText(text).width > max && size > 6 && guard++ < 60) { size *= 0.94; set(); }
    }
    return size;
  }
  /** Draw one text element; returns its bounding box in card units (for the editor). */
  function drawText(ctx, t, s, extra) {
    const text = PB.fill(t.text, extra).trim();
    if (!text) return null;
    ctx.save();
    const size = fitFont(ctx, text, t, s);
    ctx.textAlign = t.align || 'center'; ctx.textBaseline = 'middle';
    ctx.translate(t.x * s, t.y * s); if (t.rotate) ctx.rotate(t.rotate * Math.PI / 180);
    if (t.stroke > 0) { ctx.lineWidth = t.stroke * s; ctx.strokeStyle = t.strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(text, 0, 0); }
    ctx.fillStyle = t.color; ctx.fillText(text, 0, 0);
    const mw = ctx.measureText(text).width;
    ctx.restore();
    const left = t.align === 'left' ? 0 : t.align === 'right' ? -mw : -mw / 2;
    return { x: t.x + left / s, y: t.y - size / s * 0.6, w: mw / s, h: size / s * 1.2 };
  }

  function drawSticker(ctx, st, W, H) {
    const size = st.size * W; ctx.save();
    ctx.translate(st.x * W, st.y * H); if (st.rot) ctx.rotate(st.rot * Math.PI / 180);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (st.type === 'text') {
      ctx.font = `${PB.fontStyleFor(st.font)}800 ${size}px ${PB.fontStack(st.font)}`;
      ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = st.outline || '#FFFFFF'; ctx.strokeText(st.content, 0, 0);
      ctx.fillStyle = st.color || '#1D1B2E'; ctx.fillText(st.content, 0, 0);
    } else {
      ctx.font = `${size}px ${EMOJI_FONT}`; ctx.fillText(st.content, 0, size * 0.05);
    }
    ctx.restore();
  }
  function drawDoodles(ctx, doodles, W, H) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of doodles || []) {
      if (!d.pts.length) continue;
      ctx.strokeStyle = d.color; ctx.lineWidth = d.width * W; ctx.beginPath();
      ctx.moveTo(d.pts[0][0] * W, d.pts[0][1] * H);
      if (d.pts.length === 1) ctx.lineTo(d.pts[0][0] * W + 0.1, d.pts[0][1] * H);
      for (let i = 1; i < d.pts.length; i++) ctx.lineTo(d.pts[i][0] * W, d.pts[i][1] * H);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- Card render ---------------- */
  /**
   * layout: normalized layout; photos: canvases (one per slot);
   * opts: {scale, filter, stickers, doodles, extra:{message}, out: canvas to reuse, textBoxes: [] (filled)}
   */
  async function render(layout, photos, opts = {}) {
    const s = opts.scale || 1; const W = Math.round(layout.width * s), H = Math.round(layout.height * s);
    const c = opts.out || PB.makeCanvas(W, H); if (c.width !== W) c.width = W; if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, W, H);
    await paintBackground(ctx, layout.background, W, H);
    for (const sh of layout.shapes || []) { ctx.fillStyle = sh.fill; roundRectPath(ctx, sh.x * s, sh.y * s, sh.w * s, sh.h * s, sh.radius * s); ctx.fill(); }
    layout.slots.forEach((slot, i) => {
      const photo = photos && photos.length ? photos[i % photos.length] : null;
      const w = slot.w * s, h = slot.h * s;
      ctx.save();
      ctx.translate((slot.x + slot.w / 2) * s, (slot.y + slot.h / 2) * s);
      if (slot.rotate) ctx.rotate(slot.rotate * Math.PI / 180);
      if (slot.border > 0) {
        const b = slot.border * s; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 18 * s; ctx.shadowOffsetY = 6 * s;
        ctx.fillStyle = slot.borderColor; roundRectPath(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, (slot.radius ? slot.radius * s + b : 0)); ctx.fill(); ctx.restore();
      }
      roundRectPath(ctx, -w / 2, -h / 2, w, h, slot.radius * s); ctx.clip();
      if (photo) ctx.drawImage(preparePhoto(photo, w, h, opts.filter || 'none'), -w / 2, -h / 2, w, h);
      else { ctx.fillStyle = '#C9CCD8'; ctx.fillRect(-w / 2, -h / 2, w, h); }
      ctx.restore();
    });
    if (layout.overlay) { try { ctx.drawImage(await PB.cachedImage(layout.overlay), 0, 0, W, H); } catch (e) { /* ignore */ } }
    const boxes = [];
    (layout.texts || []).forEach(t => boxes.push(drawText(ctx, t, s, opts.extra)));
    if (opts.textBoxes) opts.textBoxes.splice(0, opts.textBoxes.length, ...boxes);
    if (opts.doodles) drawDoodles(ctx, opts.doodles, W, H);
    (opts.stickers || []).forEach(st => drawSticker(ctx, st, W, H));
    return c;
  }

  /** Placeholder "photos" for layout previews: soft gradient + simple people silhouettes. */
  const PH_COLORS = [['#FFB86B', '#FF6B8B'], ['#7FD6C2', '#3B8EA5'], ['#C3A6FF', '#6C5CE7'], ['#FFE08A', '#F59E0B'], ['#9AD0FF', '#4F7CFF'], ['#FFA8C5', '#D9467A']];
  let phCache = null;
  function placeholders(n) {
    if (!phCache) phCache = PH_COLORS.map((cols, i) => {
      const c = PB.makeCanvas(480, 360); const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 480, 360); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 360);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      const people = [[150, 0.95], [240, 1.1], [330, 0.95]].slice(0, 1 + (i % 3));
      people.forEach(([x, k], j) => {
        const px = people.length === 1 ? 240 : people.length === 2 ? 190 + j * 100 : x;
        ctx.beginPath(); ctx.arc(px, 150 * (2 - k), 46 * k, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px, 360, 92 * k, 120 * k, 0, Math.PI, 0); ctx.fill();
      });
      return c;
    });
    return Array.from({ length: n }, (_, i) => phCache[i % phCache.length]);
  }

  /* ---------------- Green screen ---------------- */
  function chromaKey(ctx, w, h, color, strength) {
    const im = ctx.getImageData(0, 0, w, h); const d = im.data;
    const lo = 70 - (strength / 100) * 60, hi = lo + 45; const green = color !== 'blue';
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const k = green ? g - (r > b ? r : b) : b - (r > g ? r : g);
      if (k > lo) d[i + 3] = k >= hi ? 0 : Math.round(255 * (1 - (k - lo) / (hi - lo)));
      if (k > 0) { if (green) d[i + 1] = r > b ? r : b; else d[i + 2] = r > g ? r : g; }   // spill suppression
    }
    ctx.putImageData(im, 0, 0);
  }
  /** Returns a new canvas: backdrop + keyed foreground. */
  function greenScreen(src, backdrop, opts) {
    const s = srcSize(src); const w = s.w, h = s.h;
    const fg = PB.makeCanvas(w, h); const fctx = fg.getContext('2d', { willReadFrequently: true });
    fctx.drawImage(src, 0, 0, w, h); chromaKey(fctx, w, h, opts.color, opts.strength);
    const out = opts.out || PB.makeCanvas(w, h); if (out.width !== w) out.width = w; if (out.height !== h) out.height = h;
    const o = out.getContext('2d');
    if (backdrop) drawCover(o, backdrop, 0, 0, w, h); else { o.fillStyle = '#fff'; o.fillRect(0, 0, w, h); }
    o.drawImage(fg, 0, 0);
    return out;
  }

  /* Built-in backdrops (drawn, no image files needed) */
  const BACKDROPS = [
    { id: 'bd-confetti', name: 'Confetti' }, { id: 'bd-disco', name: 'Disco' }, { id: 'bd-stars', name: 'Starry night' },
    { id: 'bd-beach', name: 'Beach' }, { id: 'bd-hearts', name: 'Hearts' }, { id: 'bd-curtain', name: 'Red curtain' },
  ];
  const bdCache = new Map();
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function drawBackdrop(id) {
    if (bdCache.has(id)) return bdCache.get(id);
    const W = 1600, H = 1200; const c = PB.makeCanvas(W, H); const x = c.getContext('2d'); const R = rng(42);
    if (id === 'bd-confetti') {
      x.fillStyle = '#FFD9E6'; x.fillRect(0, 0, W, H);
      const cols = ['#FFC93C', '#C8203B', '#13968F', '#6C5CE7', '#FF7AB6', '#4F7CFF'];
      for (let i = 0; i < 420; i++) { x.save(); x.translate(R() * W, R() * H); x.rotate(R() * 6.3); x.fillStyle = cols[i % cols.length]; x.fillRect(-14, -6, 28, 12); x.restore(); }
    } else if (id === 'bd-disco') {
      const cols = ['#FF3D7F', '#FFC93C', '#3DDCFF', '#8A5CFF', '#22D39A', '#FF8A3D'];
      for (let i = 0; i < 24; i++) { x.beginPath(); x.moveTo(W / 2, H / 2); x.arc(W / 2, H / 2, W, i / 24 * Math.PI * 2, (i + 1) / 24 * Math.PI * 2); x.fillStyle = cols[i % cols.length]; x.fill(); }
      const g = x.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .7); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else if (id === 'bd-stars') {
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0B1340'); g.addColorStop(1, '#5B2A86'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; x.beginPath(); x.arc(R() * W, R() * H, R() * 2.6 + 0.4, 0, 7); x.fill(); }
      x.fillStyle = '#FFF6D0'; x.beginPath(); x.arc(W * 0.8, H * 0.2, 90, 0, 7); x.fill();
    } else if (id === 'bd-beach') {
      let g = x.createLinearGradient(0, 0, 0, H * 0.55); g.addColorStop(0, '#5EC8F2'); g.addColorStop(1, '#BFEFFF'); x.fillStyle = g; x.fillRect(0, 0, W, H * 0.55);
      x.fillStyle = '#FFE27A'; x.beginPath(); x.arc(W * 0.78, H * 0.18, 100, 0, 7); x.fill();
      g = x.createLinearGradient(0, H * 0.55, 0, H * 0.75); g.addColorStop(0, '#1A9BC7'); g.addColorStop(1, '#3DC4D9'); x.fillStyle = g; x.fillRect(0, H * 0.55, W, H * 0.2);
      x.fillStyle = '#F3D9A4'; x.fillRect(0, H * 0.75, W, H * 0.25);
    } else if (id === 'bd-hearts') {
      x.fillStyle = '#FFE1EC'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        const cx = R() * W, cy = R() * H, sz = 30 + R() * 60; x.fillStyle = ['#FF5C8A', '#FF9EBB', '#E0245E'][i % 3];
        x.beginPath(); x.moveTo(cx, cy + sz * 0.3); x.bezierCurveTo(cx, cy, cx - sz / 2, cy, cx - sz / 2, cy + sz * 0.3);
        x.bezierCurveTo(cx - sz / 2, cy + sz * 0.6, cx, cy + sz * 0.8, cx, cy + sz); x.bezierCurveTo(cx, cy + sz * 0.8, cx + sz / 2, cy + sz * 0.6, cx + sz / 2, cy + sz * 0.3);
        x.bezierCurveTo(cx + sz / 2, cy, cx, cy, cx, cy + sz * 0.3); x.fill();
      }
    } else {
      for (let i = 0; i < W; i += 80) { const g = x.createLinearGradient(i, 0, i + 80, 0); g.addColorStop(0, '#6E0A1C'); g.addColorStop(0.45, '#C8203B'); g.addColorStop(1, '#6E0A1C'); x.fillStyle = g; x.fillRect(i, 0, 80, H); }
      const g = x.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H / 2, W * 0.7); g.addColorStop(0, 'rgba(255,220,150,.35)'); g.addColorStop(1, 'rgba(0,0,0,.4)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    bdCache.set(id, c); return c;
  }
  async function backdropSource(id) {
    if (!id) return null;
    if (id.startsWith('bd-')) return drawBackdrop(id);
    try { const a = await PB.db.get('assets', id); if (a && a.data) return await PB.cachedImage(a.data); } catch (e) { /* ignore */ }
    return drawBackdrop('bd-confetti');
  }

  /* ---------------- GIF ---------------- */
  /** frames: canvases. Returns {blob, preview(canvas of first frame)} */
  async function makeGif(frames, opts = {}) {
    const S = PB.settings; const target = opts.size || S.gifSize || 540;
    const f0 = srcSize(frames[0]); let ar = f0.w / f0.h; ar = PB.clamp(ar, 3 / 4, 4 / 3);
    const w = Math.round(ar >= 1 ? target : target * ar), h0 = Math.round(ar >= 1 ? target / ar : target);
    const band = S.eventName ? Math.round(h0 * 0.13) : 0; const h = h0 + band;
    const c = PB.makeCanvas(w, h); const ctx = c.getContext('2d', { willReadFrequently: true });
    const datas = [];
    let seq = frames.slice();
    if (S.gifBoomerang && frames.length > 2) seq = frames.concat(frames.slice(1, -1).reverse());
    const prepared = new Map();
    for (const f of seq) {
      if (!prepared.has(f)) prepared.set(f, preparePhoto(f, w, h0, opts.filter || 'none'));
      // band colours sit exactly on the GIF palette so they stay crisp (no dithering)
      ctx.fillStyle = '#332B33'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(prepared.get(f), 0, 0);
      if (band) {
        ctx.fillStyle = '#FFD533'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const t = { font: 'Display', size: band * 0.5, weight: 400, maxWidth: w * 0.9 };
        fitFont(ctx, S.eventName, t, 1); ctx.fillText(S.eventName, w / 2, h0 + band / 2);
      }
      datas.push(ctx.getImageData(0, 0, w, h));
      await PB.sleep(0);
    }
    const blob = PB.encodeGIF(datas, S.gifDelay || 140);
    const prev = PB.makeCanvas(w, h); prev.getContext('2d').putImageData(datas[0], 0, 0);
    return { blob, preview: prev, width: w, height: h };
  }

  /** Thumbnail data URL for gallery */
  function thumbOf(canvas, max = 420) {
    const s = Math.min(1, max / Math.max(canvas.width, canvas.height));
    const t = PB.makeCanvas(canvas.width * s, canvas.height * s); t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL('image/jpeg', 0.8);
  }

  PB.compose = { FILTERS, applyFilter, render, placeholders, drawCover, drawContain, preparePhoto, roundRectPath, chromaKey, greenScreen, BACKDROPS, drawBackdrop, backdropSource, makeGif, thumbOf, EMOJI_FONT, fitFont };
})(window.PB);
