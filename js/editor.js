/* PartyBooth — visual card layout editor (drag photo areas and text on the card) */
'use strict';
(function (PB) {
  const $ = PB.$, el = PB.el;
  const ed = { L: null, sel: null, scale: 1, boxes: [], onDone: null, drag: null, queued: false, rendering: false, isNew: false };
  PB.editor = ed;

  ed.open = function (layout, onDone, isNew) {
    ed.L = JSON.parse(JSON.stringify(layout)); ed.L.builtin = false;
    ed.sel = null; ed.onDone = onDone; ed.isNew = !!isNew;
    PB.app.show('editor');
    $('#edName').value = ed.L.name;
    buildPanel(); requestRender();
  };

  function requestRender() {
    if (ed.rendering) { ed.queued = true; return; }
    ed.rendering = true;
    requestAnimationFrame(async () => {
      try { await render(); } catch (e) { console.error(e); }
      ed.rendering = false;
      if (ed.queued) { ed.queued = false; requestRender(); }
    });
  }

  async function render() {
    const L = ed.L; const wrap = $('#edStageWrap'); const r = wrap.getBoundingClientRect();
    const availW = Math.max(100, r.width - 40), availH = Math.max(100, r.height - 40);
    ed.scale = Math.min(availW / L.width, availH / L.height);
    const cssW = Math.round(L.width * ed.scale), cssH = Math.round(L.height * ed.scale);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = $('#edCanvas'), ov = $('#edOverlay');
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    const boxes = [];
    await PB.compose.render(L, PB.compose.placeholders(L.slots.length), { scale: ed.scale * dpr, out: cv, textBoxes: boxes });
    ed.boxes = boxes;
    const cr = cv.getBoundingClientRect();
    ov.style.left = (cr.left - r.left) + 'px'; ov.style.top = (cr.top - r.top) + 'px';
    ov.style.width = cssW + 'px'; ov.style.height = cssH + 'px';
    ov.width = Math.round(cssW * dpr); ov.height = Math.round(cssH * dpr);
    const ctx = ov.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
    const s = ed.scale;
    L.slots.forEach((sl, i) => {
      ctx.save(); ctx.translate((sl.x + sl.w / 2) * s, (sl.y + sl.h / 2) * s); ctx.rotate((sl.rotate || 0) * Math.PI / 180);
      const isSel = ed.sel && ed.sel.kind === 'slot' && ed.sel.i === i;
      ctx.setLineDash(isSel ? [] : [8, 6]); ctx.lineWidth = isSel ? 3 : 2; ctx.strokeStyle = isSel ? '#13968F' : 'rgba(29,27,46,.75)';
      ctx.strokeRect(-sl.w * s / 2, -sl.h * s / 2, sl.w * s, sl.h * s);
      ctx.setLineDash([]); ctx.fillStyle = isSel ? '#13968F' : '#1D1B2E';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 18px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), 0, 1);
      if (isSel) { ctx.fillStyle = '#13968F'; ctx.fillRect(sl.w * s / 2 - 11, sl.h * s / 2 - 11, 22, 22); }
      ctx.restore();
    });
    if (ed.sel && ed.sel.kind === 'text' && ed.boxes[ed.sel.i]) {
      const b = ed.boxes[ed.sel.i]; ctx.lineWidth = 2; ctx.strokeStyle = '#13968F'; ctx.strokeRect(b.x * s - 4, b.y * s - 4, b.w * s + 8, b.h * s + 8);
      ctx.fillStyle = '#13968F'; ctx.fillRect((b.x + b.w) * s - 7, (b.y + b.h) * s - 7, 22, 22);
    }
  }

  /* ---------- Hit testing & dragging ---------- */
  function toCard(e) { const r = $('#edOverlay').getBoundingClientRect(); return { x: (e.clientX - r.left) / ed.scale, y: (e.clientY - r.top) / ed.scale }; }
  function inSlot(p, sl) {
    const cx = sl.x + sl.w / 2, cy = sl.y + sl.h / 2; const a = -(sl.rotate || 0) * Math.PI / 180;
    const dx = p.x - cx, dy = p.y - cy; const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
    return { inside: Math.abs(x) <= sl.w / 2 && Math.abs(y) <= sl.h / 2, onHandle: Math.abs(x - sl.w / 2) < 22 / ed.scale && Math.abs(y - sl.h / 2) < 22 / ed.scale };
  }
  function hit(p) {
    const sel = ed.sel; const hs = 22 / ed.scale;
    if (sel && sel.kind === 'slot') { const t = inSlot(p, ed.L.slots[sel.i]); if (t.onHandle) return { kind: 'slot', i: sel.i, handle: true }; }
    if (sel && sel.kind === 'text') { const b = ed.boxes[sel.i]; if (b && Math.abs(p.x - (b.x + b.w)) < hs && Math.abs(p.y - (b.y + b.h)) < hs) return { kind: 'text', i: sel.i, handle: true }; }
    for (let i = ed.boxes.length - 1; i >= 0; i--) { const b = ed.boxes[i]; if (b && p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) return { kind: 'text', i }; }
    for (let i = ed.L.slots.length - 1; i >= 0; i--) if (inSlot(p, ed.L.slots[i]).inside) return { kind: 'slot', i };
    return null;
  }
  function bindStage() {
    const ov = $('#edOverlay');
    ov.addEventListener('pointerdown', e => {
      e.preventDefault(); const p = toCard(e); const h = hit(p);
      if (!h) { ed.sel = null; buildPanel(); requestRender(); return; }
      const changed = !ed.sel || ed.sel.kind !== h.kind || ed.sel.i !== h.i;
      ed.sel = { kind: h.kind, i: h.i };
      const obj = h.kind === 'slot' ? ed.L.slots[h.i] : ed.L.texts[h.i];
      ed.drag = { id: e.pointerId, start: p, orig: JSON.parse(JSON.stringify(obj)), handle: !!h.handle, box: ed.boxes[h.i] };
      ov.setPointerCapture(e.pointerId);
      if (changed) buildPanel();
      requestRender();
    });
    ov.addEventListener('pointermove', e => {
      const d = ed.drag; if (!d || d.id !== e.pointerId) { const h = hit(toCard(e)); ov.style.cursor = h ? (h.handle ? 'nwse-resize' : 'move') : 'default'; return; }
      const p = toCard(e); const dx = p.x - d.start.x, dy = p.y - d.start.y; const L = ed.L;
      const snap = 10 / ed.scale;
      if (ed.sel.kind === 'slot') {
        const sl = L.slots[ed.sel.i];
        if (d.handle) {
          sl.w = Math.max(30, Math.round(d.orig.w + dx)); sl.h = Math.max(30, Math.round(d.orig.h + dy));
          if (e.shiftKey) sl.h = Math.round(sl.w * d.orig.h / d.orig.w);
        } else {
          sl.x = Math.round(d.orig.x + dx); sl.y = Math.round(d.orig.y + dy);
          if (Math.abs(sl.x + sl.w / 2 - L.width / 2) < snap) sl.x = Math.round(L.width / 2 - sl.w / 2);
        }
      } else {
        const t = L.texts[ed.sel.i];
        if (d.handle && d.box) { const k = Math.max(0.2, (d.box.h + dy) / d.box.h); t.size = Math.max(8, Math.round(d.orig.size * k)); }
        else { t.x = Math.round(d.orig.x + dx); t.y = Math.round(d.orig.y + dy); if (t.align === 'center' && Math.abs(t.x - L.width / 2) < snap) t.x = Math.round(L.width / 2); }
      }
      syncFields(); requestRender();
    });
    const end = e => { if (ed.drag && ed.drag.id === e.pointerId) ed.drag = null; };
    ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
    document.addEventListener('keydown', e => {
      if (PB.app.state.screen !== 'editor' || !ed.sel || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const obj = ed.sel.kind === 'slot' ? ed.L.slots[ed.sel.i] : ed.L.texts[ed.sel.i]; if (!obj) return;
      const step = e.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) { e.preventDefault(); obj.x += moves[e.key][0]; obj.y += moves[e.key][1]; syncFields(); requestRender(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
    });
    window.addEventListener('resize', () => { if (PB.app.state.screen === 'editor') requestRender(); });
  }

  function removeSelected() {
    if (!ed.sel) return;
    if (ed.sel.kind === 'slot') { if (ed.L.slots.length <= 1) { PB.toast('A card needs at least one photo area.', true); return; } ed.L.slots.splice(ed.sel.i, 1); }
    else ed.L.texts.splice(ed.sel.i, 1);
    ed.sel = null; buildPanel(); requestRender();
  }

  /* ---------- Inspector panel ---------- */
  const fields = {};
  function num(obj, key, label, opts = {}) {
    const inp = el('input', { type: 'number', step: opts.step || 1, value: Math.round((obj[key] || 0) * 100) / 100, 'aria-label': label });
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (!isNaN(v)) { obj[key] = v; requestRender(); } });
    fields[key] = { inp, obj, key };
    return el('div', { class: 'ep-row' }, [el('label', { text: label }), inp, opts.after || null]);
  }
  function syncFields() { for (const k in fields) { const f = fields[k]; if (document.activeElement !== f.inp && f.obj) f.inp.value = Math.round((f.obj[f.key] || 0) * 100) / 100; } }

  function buildPanel() {
    const P = $('#edPanel'); P.innerHTML = ''; for (const k in fields) delete fields[k];
    const L = ed.L;
    // Card
    P.appendChild(el('h4', { text: 'Card' }));
    const presetSel = el('select', { 'aria-label': 'Card size' });
    let match = PB.layouts.PRESETS.find(p => p.w === L.width && p.h === L.height);
    PB.layouts.PRESETS.forEach(p => presetSel.appendChild(el('option', { value: p.id, selected: match && match.id === p.id }, `${p.label} (${p.w}×${p.h})`)));
    presetSel.appendChild(el('option', { value: 'custom', selected: !match }, `Custom (${L.width}×${L.height})`));
    presetSel.addEventListener('change', () => {
      const p = PB.layouts.PRESETS.find(x => x.id === presetSel.value); if (!p) return;
      resizeCard(p.w, p.h); L.print = p.print; buildPanel(); requestRender();
    });
    P.appendChild(el('div', { class: 'ep-row' }, [el('label', { text: 'Size' }), presetSel]));
    const printSel = el('select', { 'aria-label': 'Print as' });
    [['auto', 'Fit to paper'], ['4x6', '4×6 portrait'], ['6x4', '6×4 landscape'], ['2x6', '2×6 strip (two per 4×6 sheet)'], ['5x7', '5×7'], ['7x5', '7×5'], ['6x8', '6×8'], ['none', 'Digital only']].forEach(([v, l]) => printSel.appendChild(el('option', { value: v, selected: L.print === v }, l)));
    printSel.addEventListener('change', () => { L.print = printSel.value; });
    P.appendChild(el('div', { class: 'ep-row' }, [el('label', { text: 'Print' }), printSel]));

    // Background
    P.appendChild(el('h4', { text: 'Background' }));
    const isImg = typeof L.background === 'string' && L.background.startsWith('data:');
    const isGrad = L.background && typeof L.background === 'object' && L.background.gradient;
    const c1 = el('input', { type: 'color', value: isGrad ? L.background.gradient[0] : (isImg ? '#ffffff' : (L.background || '#ffffff')), 'aria-label': 'Background colour' });
    const c2 = el('input', { type: 'color', value: isGrad ? L.background.gradient[1] : '#ffd3e1', 'aria-label': 'Second gradient colour' });
    const gradOn = el('input', { type: 'checkbox', checked: !!isGrad, 'aria-label': 'Use gradient' });
    const applyBg = () => { L.background = gradOn.checked ? { gradient: [c1.value, c2.value], angle: 160 } : c1.value; requestRender(); };
    c1.addEventListener('input', applyBg); c2.addEventListener('input', applyBg); gradOn.addEventListener('change', applyBg);
    P.appendChild(el('div', { class: 'ep-row' }, [el('label', { text: 'Colour' }), c1, el('label', { style: { minWidth: '0' } }, [gradOn, ' Fade to ']), c2]));
    P.appendChild(el('div', { class: 'ep-row' }, [
      el('button', { class: 'btn small', onclick: async () => { const f = await PB.pickFile('image/*'); if (!f) return; L.background = await shrinkImage(f, Math.max(L.width, L.height), 'image/jpeg'); buildPanel(); requestRender(); } }, isImg ? 'Replace image' : 'Use an image'),
      isImg ? el('button', { class: 'btn small', onclick: () => { L.background = '#FFFFFF'; buildPanel(); requestRender(); } }, 'Remove image') : null,
    ]));

    // Overlay
    P.appendChild(el('h4', { text: 'Frame on top (PNG with see-through windows)' }));
    P.appendChild(el('div', { class: 'ep-row' }, [
      el('button', { class: 'btn small', onclick: async () => { const f = await PB.pickFile('image/png,image/webp'); if (!f) return; L.overlay = await shrinkImage(f, Math.max(L.width, L.height), 'image/png', L.width, L.height); buildPanel(); requestRender(); } }, L.overlay ? 'Replace frame' : 'Add frame'),
      L.overlay ? el('button', { class: 'btn small', onclick: async () => {
        const slots = PB.layouts.detectSlots(await PB.loadImage(L.overlay));
        if (!slots.length) { PB.toast('No see-through windows found in the frame.', true); return; }
        const sx = L.width / ((await PB.loadImage(L.overlay)).naturalWidth), sy = L.height / ((await PB.loadImage(L.overlay)).naturalHeight);
        L.slots = slots.map(s => ({ x: s.x * sx, y: s.y * sy, w: s.w * sx, h: s.h * sy, rotate: 0, radius: 0, border: 0, borderColor: '#FFFFFF' }));
        ed.sel = null; buildPanel(); requestRender(); PB.toast(`Placed ${slots.length} photo area${slots.length > 1 ? 's' : ''}.`);
      } }, 'Find photo windows') : null,
      L.overlay ? el('button', { class: 'btn small', onclick: () => { L.overlay = null; buildPanel(); requestRender(); } }, 'Remove frame') : null,
    ]));

    // Elements
    P.appendChild(el('h4', { text: 'On the card' }));
    const list = el('div', { class: 'el-list' });
    L.slots.forEach((s, i) => list.appendChild(el('button', { 'aria-current': String(!!ed.sel && ed.sel.kind === 'slot' && ed.sel.i === i), onclick: () => { ed.sel = { kind: 'slot', i }; buildPanel(); requestRender(); } }, `Photo ${i + 1}`)));
    L.texts.forEach((t, i) => list.appendChild(el('button', { 'aria-current': String(!!ed.sel && ed.sel.kind === 'text' && ed.sel.i === i), onclick: () => { ed.sel = { kind: 'text', i }; buildPanel(); requestRender(); } }, `Text: ${t.text || '(empty)'}`)));
    P.appendChild(list);
    P.appendChild(el('div', { class: 'ep-row' }, [
      el('button', { class: 'btn small', onclick: () => { const w = L.width * 0.4, h = w * 0.75; L.slots.push({ x: (L.width - w) / 2, y: (L.height - h) / 2, w, h, rotate: 0, radius: 0, border: 0, borderColor: '#FFFFFF' }); ed.sel = { kind: 'slot', i: L.slots.length - 1 }; buildPanel(); requestRender(); } }, '+ Photo area'),
      el('button', { class: 'btn small', onclick: () => { L.texts.push({ text: '{event}', x: L.width / 2, y: L.height * 0.9, size: Math.round(L.width / 16), font: 'Display', weight: 400, color: '#1D1B2E', align: 'center', maxWidth: L.width * 0.9, rotate: 0, stroke: 0, strokeColor: '#FFFFFF' }); ed.sel = { kind: 'text', i: L.texts.length - 1 }; buildPanel(); requestRender(); } }, '+ Text'),
    ]));

    // Selected element
    if (ed.sel && ed.sel.kind === 'slot' && L.slots[ed.sel.i]) {
      const s = L.slots[ed.sel.i];
      P.appendChild(el('h4', { text: `Photo ${ed.sel.i + 1}` }));
      P.append(num(s, 'x', 'Left'), num(s, 'y', 'Top'), num(s, 'w', 'Width'), num(s, 'h', 'Height'), num(s, 'rotate', 'Tilt °', { step: 0.5 }), num(s, 'radius', 'Corners'), num(s, 'border', 'Border'));
      const bc = el('input', { type: 'color', value: s.borderColor || '#ffffff', 'aria-label': 'Border colour' }); bc.addEventListener('input', () => { s.borderColor = bc.value; requestRender(); });
      P.appendChild(el('div', { class: 'ep-row' }, [el('label', { text: 'Border colour' }), bc]));
      P.appendChild(el('div', { class: 'ep-row' }, [el('button', { class: 'btn small', onclick: () => { L.slots.push(Object.assign({}, s, { x: s.x + 30, y: s.y + 30 })); ed.sel = { kind: 'slot', i: L.slots.length - 1 }; buildPanel(); requestRender(); } }, 'Duplicate'), el('button', { class: 'btn small danger', onclick: removeSelected }, 'Remove')]));
    }
    if (ed.sel && ed.sel.kind === 'text' && L.texts[ed.sel.i]) {
      const t = L.texts[ed.sel.i];
      P.appendChild(el('h4', { text: 'Text' }));
      const ta = el('input', { type: 'text', value: t.text, 'aria-label': 'Text' }); ta.addEventListener('input', () => { t.text = ta.value; requestRender(); });
      P.appendChild(el('div', { class: 'ep-row' }, [ta]));
      P.appendChild(el('p', { class: 'panel-note', style: { color: 'var(--muted)', margin: '0 0 8px' }, text: 'Fill-ins: {event} {date} {hashtag} {message}' }));
      const fs = el('select', { 'aria-label': 'Font' }); Object.keys(PB.FONTS).forEach(f => fs.appendChild(el('option', { value: f, selected: t.font === f }, f)));
      fs.addEventListener('change', () => { t.font = fs.value; t.weight = fs.value === 'Rounded' ? 800 : fs.value === 'Handwritten' || fs.value === 'Elegant' ? 700 : 400; requestRender(); });
      const col = el('input', { type: 'color', value: t.color, 'aria-label': 'Text colour' }); col.addEventListener('input', () => { t.color = col.value; requestRender(); });
      P.appendChild(el('div', { class: 'ep-row' }, [el('label', { text: 'Font' }), fs, col]));
      const al = el('select', { 'aria-label': 'Alignment' }); ['left', 'center', 'right'].forEach(a => al.appendChild(el('option', { value: a, selected: t.align === a }, a[0].toUpperCase() + a.slice(1))));
      al.addEventListener('change', () => { t.align = al.value; requestRender(); });
      P.appendChild(el('div', { class: 'ep-row' }, [el('label', { text: 'Align' }), al]));
      P.append(num(t, 'size', 'Size'), num(t, 'x', 'Left'), num(t, 'y', 'Top'), num(t, 'maxWidth', 'Max width'), num(t, 'rotate', 'Tilt °', { step: 0.5 }), num(t, 'stroke', 'Outline'));
      P.appendChild(el('div', { class: 'ep-row' }, [el('button', { class: 'btn small danger', onclick: removeSelected }, 'Remove text')]));
    }

    P.appendChild(el('h4', { text: 'File' }));
    P.appendChild(el('div', { class: 'ep-row' }, [
      el('button', { class: 'btn small', onclick: () => { ed.L.name = $('#edName').value || ed.L.name; PB.download(new Blob([PB.layouts.exportJSON(ed.L)], { type: 'application/json' }), PB.slug(ed.L.name) + '.pblayout.json'); } }, 'Export layout file'),
    ]));
  }

  function resizeCard(w, h) {
    const L = ed.L; const sx = w / L.width, sy = h / L.height, sm = Math.min(sx, sy);
    L.slots.forEach(s => { s.x *= sx; s.y *= sy; s.w *= sx; s.h *= sy; });
    L.texts.forEach(t => { t.x *= sx; t.y *= sy; t.size *= sm; t.maxWidth *= sx; });
    (L.shapes || []).forEach(s => { s.x *= sx; s.y *= sy; s.w *= sx; s.h *= sy; });
    L.width = w; L.height = h;
  }

  async function shrinkImage(file, maxSide, type, exactW, exactH) {
    const url = await PB.blobToDataURL(file); const img = await PB.loadImage(url);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (exactW && exactH) { w = exactW; h = exactH; }
    else { const s = Math.min(1, maxSide / Math.max(w, h)); w *= s; h *= s; }
    const c = PB.makeCanvas(w, h); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(type, 0.9);
  }

  async function save() {
    ed.L.name = ($('#edName').value || 'My card').trim();
    try {
      const saved = await PB.layouts.save(ed.L);
      const s = PB.settings; if (!s.enabledLayouts.includes(saved.id)) s.enabledLayouts.push(saved.id); PB.saveSettings();
      PB.toast('Layout saved');
      const cb = ed.onDone; ed.onDone = null; cb && cb(saved);
    } catch (e) { PB.toast('Could not save: ' + e.message, true); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindStage();
    $('#btnEditorSave').addEventListener('click', save);
    $('#btnEditorCancel').addEventListener('click', async () => {
      if (!(await PB.confirm('Leave without saving?', 'Changes to this layout will be lost.', 'Leave'))) return;
      const cb = ed.onDone; ed.onDone = null; cb && cb(null);
    });
  });
})(window.PB);
