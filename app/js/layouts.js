/* PartyBooth — card layouts: built-ins, custom storage, import (JSON / PNG with transparent windows / JPG) */
'use strict';
(function (PB) {
  const INK = '#1D1B2E', BULB = '#FFC93C', RED = '#A3122A', TEAL = '#13968F';

  const BUILTIN = [
    {
      id: 'classic-strip', name: 'Classic strip', width: 600, height: 1800, print: '2x6', background: '#FFFFFF',
      slots: [{ x: 40, y: 40, w: 520, h: 400 }, { x: 40, y: 460, w: 520, h: 400 }, { x: 40, y: 880, w: 520, h: 400 }],
      shapes: [{ x: 250, y: 1340, w: 100, h: 8, fill: RED, radius: 4 }],
      texts: [
        { text: '{event}', x: 300, y: 1450, size: 64, font: 'Display', color: INK, align: 'center', maxWidth: 520 },
        { text: '{date}', x: 300, y: 1545, size: 34, font: 'Rounded', weight: 800, color: '#646A80', align: 'center', maxWidth: 520 },
        { text: '{hashtag}', x: 300, y: 1610, size: 34, font: 'Rounded', weight: 800, color: TEAL, align: 'center', maxWidth: 520 },
      ],
    },
    {
      id: 'strip-4', name: 'Four-shot strip', width: 600, height: 1800, print: '2x6', background: INK,
      slots: [{ x: 40, y: 40, w: 520, h: 345, radius: 10 }, { x: 40, y: 405, w: 520, h: 345, radius: 10 }, { x: 40, y: 770, w: 520, h: 345, radius: 10 }, { x: 40, y: 1135, w: 520, h: 345, radius: 10 }],
      texts: [
        { text: '{event}', x: 300, y: 1580, size: 60, font: 'Display', color: BULB, align: 'center', maxWidth: 520 },
        { text: '{date}', x: 300, y: 1680, size: 32, font: 'Rounded', weight: 800, color: '#FFFFFF', align: 'center', maxWidth: 520 },
      ],
    },
    {
      id: 'party-grid', name: 'Party grid', width: 1200, height: 1800, print: '4x6',
      background: { gradient: ['#2B2942', '#1D1B2E'], angle: 180 },
      slots: [{ x: 60, y: 250, w: 525, h: 690, radius: 16 }, { x: 615, y: 250, w: 525, h: 690, radius: 16 }, { x: 60, y: 970, w: 525, h: 690, radius: 16 }, { x: 615, y: 970, w: 525, h: 690, radius: 16 }],
      texts: [
        { text: '{event}', x: 600, y: 140, size: 96, font: 'Display', color: BULB, align: 'center', maxWidth: 1080 },
        { text: '{date}   {hashtag}', x: 600, y: 1730, size: 40, font: 'Rounded', weight: 800, color: '#FFFFFF', align: 'center', maxWidth: 1080 },
      ],
    },
    {
      id: 'postcard', name: 'Postcard', width: 1800, height: 1200, print: '6x4', background: '#FFFFFF',
      slots: [{ x: 50, y: 50, w: 1240, h: 1100 }],
      shapes: [{ x: 1320, y: 50, w: 6, h: 1100, fill: '#E2E4EC' }],
      texts: [
        { text: 'Greetings from', x: 1560, y: 360, size: 70, font: 'Script', color: RED, align: 'center', maxWidth: 420 },
        { text: '{event}', x: 1560, y: 560, size: 84, font: 'Display', color: INK, align: 'center', maxWidth: 420 },
        { text: '{date}', x: 1560, y: 720, size: 38, font: 'Rounded', weight: 800, color: '#646A80', align: 'center', maxWidth: 420 },
        { text: '{hashtag}', x: 1560, y: 790, size: 38, font: 'Rounded', weight: 800, color: TEAL, align: 'center', maxWidth: 420 },
      ],
    },
    {
      id: 'polaroid', name: 'Instant snap', width: 1200, height: 1800, print: '4x6', background: '#F4F5F8',
      shapes: [{ x: 70, y: 70, w: 1060, h: 1500, fill: '#FFFFFF', radius: 6 }],
      slots: [{ x: 120, y: 120, w: 960, h: 1080 }],
      texts: [
        { text: '{event}', x: 600, y: 1340, size: 120, font: 'Handwritten', color: INK, align: 'center', maxWidth: 940, rotate: -2 },
        { text: '{date}', x: 600, y: 1470, size: 66, font: 'Handwritten', color: '#646A80', align: 'center', maxWidth: 940, rotate: -2 },
      ],
    },
    {
      id: 'scrapbook', name: 'Scrapbook', width: 1200, height: 1800, print: '4x6',
      background: { gradient: ['#FFD3E1', '#FFE9A8'], angle: 160 },
      slots: [
        { x: 90, y: 150, w: 700, h: 525, rotate: -4, border: 22, borderColor: '#FFFFFF' },
        { x: 420, y: 650, w: 700, h: 525, rotate: 3, border: 22, borderColor: '#FFFFFF' },
        { x: 110, y: 1140, w: 700, h: 525, rotate: -2.5, border: 22, borderColor: '#FFFFFF' },
      ],
      texts: [
        { text: '{event}', x: 1000, y: 1420, size: 92, font: 'Script', color: RED, align: 'center', maxWidth: 360, rotate: -8 },
        { text: '{date}', x: 1000, y: 1560, size: 40, font: 'Rounded', weight: 800, color: INK, align: 'center', maxWidth: 340, rotate: -8 },
      ],
    },
    {
      id: 'duo', name: 'Duo (wedding)', width: 1200, height: 1800, print: '4x6', background: '#FFFFFF',
      slots: [{ x: 70, y: 70, w: 1060, h: 720 }, { x: 70, y: 820, w: 1060, h: 720 }],
      texts: [
        { text: '{event}', x: 600, y: 1640, size: 88, font: 'Elegant', color: INK, align: 'center', maxWidth: 1060 },
        { text: '{date}', x: 600, y: 1738, size: 36, font: 'Rounded', weight: 600, color: '#646A80', align: 'center', maxWidth: 1060 },
      ],
    },
    {
      id: 'trio', name: 'Big + two', width: 1800, height: 1200, print: '6x4',
      background: { gradient: ['#C8203B', '#7A0C20'], angle: 135 },
      slots: [{ x: 50, y: 50, w: 1060, h: 795, radius: 12 }, { x: 1140, y: 50, w: 610, h: 380, radius: 12 }, { x: 1140, y: 465, w: 610, h: 380, radius: 12 }],
      texts: [
        { text: '{event}', x: 900, y: 990, size: 100, font: 'Display', color: BULB, align: 'center', maxWidth: 1700 },
        { text: '{date}   {hashtag}', x: 900, y: 1100, size: 42, font: 'Rounded', weight: 800, color: '#FFFFFF', align: 'center', maxWidth: 1700 },
      ],
    },
    {
      id: 'story', name: 'Phone story', width: 1080, height: 1920, print: 'none', background: INK,
      slots: [{ x: 0, y: 0, w: 1080, h: 1580 }],
      texts: [
        { text: '{event}', x: 540, y: 1700, size: 86, font: 'Display', color: BULB, align: 'center', maxWidth: 1000 },
        { text: '{date}   {hashtag}', x: 540, y: 1810, size: 40, font: 'Rounded', weight: 800, color: '#FFFFFF', align: 'center', maxWidth: 1000 },
      ],
    },
  ].map(l => normalize(Object.assign({ builtin: true }, l)));

  /** Fill in defaults and coerce numbers so imported/edited layouts are safe to render. */
  function normalize(src) {
    const n = v => (typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0);
    const L = {
      id: src.id || 'lay-' + PB.uid(),
      name: String(src.name || 'Untitled layout').slice(0, 60),
      width: PB.clamp(Math.round(n(src.width) || 1200), 100, 6000),
      height: PB.clamp(Math.round(n(src.height) || 1800), 100, 6000),
      print: src.print || 'auto',
      background: src.background || '#FFFFFF',
      overlay: src.overlay || null,
      slots: [], texts: [], shapes: [],
      builtin: !!src.builtin, updated: src.updated || 0,
    };
    (src.slots || []).forEach(s => L.slots.push({
      x: n(s.x), y: n(s.y), w: Math.max(10, n(s.w)), h: Math.max(10, n(s.h)), rotate: n(s.rotate), radius: n(s.radius),
      border: n(s.border), borderColor: s.borderColor || '#FFFFFF',
    }));
    (src.texts || []).forEach(t => L.texts.push({
      text: String(t.text == null ? '' : t.text), x: n(t.x), y: n(t.y), size: Math.max(6, n(t.size) || 48), font: t.font || 'Rounded',
      weight: t.weight || (t.font === 'Rounded' ? 800 : 400), color: t.color || '#1D1B2E', align: t.align || 'center',
      maxWidth: n(t.maxWidth) || 0, rotate: n(t.rotate), stroke: n(t.stroke), strokeColor: t.strokeColor || '#FFFFFF',
    }));
    (src.shapes || []).forEach(s => L.shapes.push({ x: n(s.x), y: n(s.y), w: n(s.w), h: n(s.h), fill: s.fill || '#000000', radius: n(s.radius) }));
    if (!L.slots.length) L.slots.push({ x: L.width * 0.08, y: L.height * 0.08, w: L.width * 0.84, h: L.height * 0.6, rotate: 0, radius: 0, border: 0, borderColor: '#FFFFFF' });
    return L;
  }

  let custom = [];
  PB.layouts = {
    normalize,
    builtins: BUILTIN,
    async load() { try { custom = (await PB.db.all('layouts')).map(normalize).sort((a, b) => a.name.localeCompare(b.name)); } catch (e) { custom = []; } return this.all(); },
    all() { return BUILTIN.concat(custom); },
    custom() { return custom.slice(); },
    get(id) { return this.all().find(l => l.id === id) || null; },
    enabled() {
      const ids = PB.settings.enabledLayouts || [];
      const list = this.all().filter(l => ids.includes(l.id));
      return list.length ? list : [BUILTIN[0]];
    },
    async save(layout) {
      const L = normalize(Object.assign({}, layout, { builtin: false, updated: Date.now() }));
      if (BUILTIN.some(b => b.id === L.id)) L.id = 'lay-' + PB.uid();
      await PB.db.put('layouts', JSON.parse(JSON.stringify(L)));
      custom = custom.filter(c => c.id !== L.id).concat([L]).sort((a, b) => a.name.localeCompare(b.name));
      thumbCache.delete(L.id);
      return L;
    },
    async remove(id) {
      await PB.db.del('layouts', id); custom = custom.filter(c => c.id !== id); thumbCache.delete(id);
      PB.settings.enabledLayouts = (PB.settings.enabledLayouts || []).filter(x => x !== id);
      if (PB.settings.defaultLayout === id) PB.settings.defaultLayout = PB.layouts.enabled()[0].id;
      PB.saveSettings();
    },
    duplicate(layout) { const c = JSON.parse(JSON.stringify(layout)); c.id = 'lay-' + PB.uid(); c.name = layout.name + ' copy'; c.builtin = false; return normalize(c); },
    exportJSON(layout) {
      const out = { pbLayout: 1 }; const L = JSON.parse(JSON.stringify(layout));
      delete L.builtin; delete L.updated; delete L.id;
      return JSON.stringify(Object.assign(out, L), null, 2);
    },
    blank(preset) {
      const p = PB.layouts.PRESETS.find(x => x.id === preset) || PB.layouts.PRESETS[0];
      return normalize({ name: 'My card', width: p.w, height: p.h, print: p.print, background: '#FFFFFF',
        slots: [{ x: p.w * 0.07, y: p.w * 0.07, w: p.w * 0.86, h: p.h * 0.62 }],
        texts: [{ text: '{event}', x: p.w / 2, y: p.h * 0.84, size: Math.round(p.w / 14), font: 'Display', color: INK, align: 'center', maxWidth: p.w * 0.86 }] });
    },
    PRESETS: [
      { id: '4x6', label: '4×6 in portrait', w: 1200, h: 1800, print: '4x6' },
      { id: '6x4', label: '6×4 in landscape', w: 1800, h: 1200, print: '6x4' },
      { id: '2x6', label: '2×6 in strip', w: 600, h: 1800, print: '2x6' },
      { id: '5x7', label: '5×7 in portrait', w: 1500, h: 2100, print: '5x7' },
      { id: '7x5', label: '7×5 in landscape', w: 2100, h: 1500, print: '7x5' },
      { id: '6x8', label: '6×8 in portrait', w: 1800, h: 2400, print: '6x8' },
      { id: 'sq', label: 'Square (social)', w: 1500, h: 1500, print: 'auto' },
      { id: 'story', label: 'Phone story 9:16', w: 1080, h: 1920, print: 'none' },
    ],
  };

  /* ---------- Import ---------- */
  /** Detect transparent "windows" in a PNG overlay. Returns slot rects in image pixels. */
  PB.layouts.detectSlots = function (img) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const sc = Math.min(1, 520 / Math.max(W, H));
    const w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc));
    const c = PB.makeCanvas(w, h); const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    let transparent = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] < 40) { mask[i] = 1; transparent++; }
    if (!transparent) return [];
    const seen = new Uint8Array(w * h); const q = new Int32Array(w * h); const comps = [];
    for (let start = 0; start < w * h; start++) {
      if (!mask[start] || seen[start]) continue;
      let qh = 0, qt = 0; q[qt++] = start; seen[start] = 1;
      let minx = w, miny = h, maxx = 0, maxy = 0, count = 0;
      while (qh < qt) {
        const p = q[qh++]; const x = p % w, y = (p / w) | 0; count++;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; q[qt++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; q[qt++] = p + 1; }
        if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; q[qt++] = p - w; }
        if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; q[qt++] = p + w; }
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (count < w * h * 0.006 || bw < 12 || bh < 12) continue;          // specks
      if (bw * bh > w * h * 0.92) continue;                                // whole-page transparency
      if (count / (bw * bh) < 0.35) continue;                              // thin outlines, not windows
      comps.push({ minx, miny, maxx, maxy });
    }
    const pad = 3 / sc; // bleed under the frame edges
    const slots = comps.map(c2 => ({
      x: Math.max(0, c2.minx / sc - pad), y: Math.max(0, c2.miny / sc - pad),
      w: Math.min(W, (c2.maxx + 1) / sc + pad) - Math.max(0, c2.minx / sc - pad),
      h: Math.min(H, (c2.maxy + 1) / sc + pad) - Math.max(0, c2.miny / sc - pad),
    })).map(s => ({ x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.w), h: Math.round(s.h) }));
    const rowTol = H * 0.04;
    slots.sort((a, b) => Math.abs(a.y - b.y) < rowTol ? a.x - b.x : a.y - b.y);
    return slots;
  };

  function guessPrint(w, h) {
    const r = w / h; const near = (a) => Math.abs(r - a) < 0.03;
    if (near(1 / 3)) return '2x6'; if (near(2 / 3)) return '4x6'; if (near(3 / 2)) return '6x4';
    if (near(5 / 7)) return '5x7'; if (near(7 / 5)) return '7x5'; if (near(3 / 4)) return '6x8';
    return 'auto';
  }

  /** Import a File. Returns {layout, note, needsEditing}. */
  PB.layouts.importFile = async function (file) {
    const name = (file.name || 'Imported').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    if (/\.json$/i.test(file.name) || file.type === 'application/json') {
      let data; try { data = JSON.parse(await PB.fileToText(file)); } catch (e) { throw new Error('That file is not valid layout JSON.'); }
      const list = Array.isArray(data) ? data : (data.layouts || [data]);
      const out = list.map(d => { const L = normalize(Object.assign({}, d, { id: undefined, builtin: false })); return L; });
      return { layouts: out, note: `${out.length} layout${out.length > 1 ? 's' : ''} imported.` };
    }
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('Use a .json layout, a PNG with transparent photo windows, or a JPG background.');
    const dataURL = await PB.blobToDataURL(file);
    const img = await PB.loadImage(dataURL);
    let W = img.naturalWidth, H = img.naturalHeight;
    let src = dataURL;
    const MAX = 3600;
    if (Math.max(W, H) > MAX) {                       // keep stored layouts a sensible size
      const s = MAX / Math.max(W, H); const c = PB.makeCanvas(W * s, H * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      src = c.toDataURL(/png|webp/i.test(file.type) ? 'image/png' : 'image/jpeg', 0.92); W = c.width; H = c.height;
    }
    const isPNG = /png|webp/i.test(file.type) || /\.(png|webp)$/i.test(file.name);
    if (isPNG) {
      const slots = PB.layouts.detectSlots(await PB.loadImage(src));
      if (slots.length) {
        return { layouts: [normalize({ name, width: W, height: H, print: guessPrint(W, H), background: '#FFFFFF', overlay: src, slots, texts: [] })],
          note: `Found ${slots.length} photo window${slots.length > 1 ? 's' : ''} in your design.` };
      }
      return { layouts: [normalize({ name, width: W, height: H, print: guessPrint(W, H), background: '#FFFFFF', overlay: src, texts: [] })],
        note: 'No transparent windows found, so one photo area was added. Drag it into place in the editor.', needsEditing: true };
    }
    return { layouts: [normalize({ name, width: W, height: H, print: guessPrint(W, H), background: src, texts: [] })],
      note: 'Your image is the card background. Place the photo areas in the editor.', needsEditing: true };
  };

  /* ---------- Thumbnails ---------- */
  const thumbCache = new Map();
  PB.layouts.thumb = async function (layout, h = 300) {
    const key = layout.id + '|' + (layout.updated || 0) + '|' + h + '|' + PB.settings.eventName + '|' + PB.settings.hashtag;
    const hit = thumbCache.get(layout.id); if (hit && hit.key === key) return hit.url;
    const scale = h / layout.height;
    const c = await PB.compose.render(layout, PB.compose.placeholders(layout.slots.length), { scale, filter: 'none' });
    const url = c.toDataURL('image/jpeg', 0.85);
    thumbCache.set(layout.id, { key, url });
    return url;
  };
  PB.layouts.clearThumbs = () => thumbCache.clear();
})(window.PB);
