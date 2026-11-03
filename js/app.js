/* PartyBooth — main controller: start screen, capture session, review & decorate, print/email/share, gallery, slideshow */
'use strict';
(function (PB) {
  const $ = PB.$, el = PB.el;
  const S = () => PB.settings;

  const STICKERS = ['🥳', '🎉', '🎈', '🎂', '👑', '🎩', '🕶️', '🥸', '💋', '🎀', '🌸', '🦄', '🐶', '🐱', '🐰', '🌈', '⭐', '💖', '🔥', '😂', '😍', '🤪', '😎', '🍾', '🥂', '🍕', '🎸', '🏆', '💯', '✨', '🦖', '🤠'];
  const INK_COLORS = ['#1D1B2E', '#FFFFFF', '#C8203B', '#FFC93C', '#13968F', '#4F7CFF', '#FF7AB6', '#22C55E'];

  const state = {
    screen: 'start', mode: 'photo', layoutId: null, backdrop: null,
    sid: 0, busy: false, shots: [], gif: null, gifFrames: [],
    filter: 'none', stickers: [], doodles: [], message: '',
    record: null, dirty: true, finalCanvas: null, selSticker: null, tab: 'filters', idleT: null,
  };
  PB.app = { state };

  function layout() { return PB.layouts.get(state.layoutId) || PB.layouts.enabled()[0]; }

  /* ================= Screens ================= */
  function show(name) {
    PB.$$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    state.screen = name;
    if (name !== 'review') clearIdle();
    if (name === 'start') { renderStart(); startAttract(); } else stopAttract();
  }
  PB.app.show = show;

  /* ================= Start screen ================= */
  async function renderStart() {
    const s = S();
    document.documentElement.style.setProperty('--bulb', s.accent || '#FFC93C');
    $('#eventTitle').textContent = s.eventName || 'Photo booth';
    $('#eventSub').textContent = [PB.fill(s.eventSub), s.hashtag].filter(Boolean).join('   ');
    const curtain = $('.curtain');
    curtain.style.background = '';
    if (s.startStyle === 'ink') curtain.style.background = 'radial-gradient(120% 90% at 50% 10%, #3B3858, #1D1B2E 70%)';
    if (s.startStyle === 'image') { try { const a = await PB.db.get('assets', 'startBg'); if (a) curtain.style.background = `center / cover no-repeat url("${a.data}")`; } catch (e) { /* ignore */ } }

    // mode chooser
    const modes = [['photo', 'Photo card'], ['gif', 'Animated GIF']].filter(([k]) => s.modes[k]);
    if (!modes.some(([k]) => k === state.mode)) state.mode = modes.length ? modes[0][0] : 'photo';
    const ms = $('#modeSwitch'); ms.innerHTML = '';
    if (modes.length > 1) modes.forEach(([k, label]) => ms.appendChild(el('button', { role: 'radio', 'aria-checked': String(state.mode === k), onclick: () => { state.mode = k; renderStart(); } }, label)));

    // layout picker
    const lp = $('#layoutPicker'); lp.innerHTML = '';
    const enabled = PB.layouts.enabled();
    if (!enabled.some(l => l.id === state.layoutId)) state.layoutId = (enabled.find(l => l.id === s.defaultLayout) || enabled[0]).id;
    if (state.mode === 'photo' && enabled.length > 1) {
      for (const L of enabled) {
        const img = el('img', { alt: '' });
        const b = el('button', { class: 'pick', role: 'radio', 'aria-checked': String(L.id === state.layoutId), onclick: () => { state.layoutId = L.id; PB.$$('.pick', lp).forEach(x => x.setAttribute('aria-checked', String(x === b))); } }, [img, el('span', { text: L.name })]);
        lp.appendChild(b);
        PB.layouts.thumb(L, 300).then(u => { img.src = u; }).catch(() => {});
      }
    }

    // backdrop picker (green screen)
    const bp = $('#backdropPicker'); bp.innerHTML = '';
    if (s.greenScreen && s.gsGuestPick) {
      const list = await backdropList();
      if (!list.some(b => b.id === state.backdrop)) state.backdrop = s.gsBackdrop;
      list.forEach(b => {
        const sw = el('span', { class: 'swatch', style: { backgroundImage: `url("${b.thumb}")` } });
        const btn = el('button', { class: 'pick', role: 'radio', 'aria-checked': String(b.id === state.backdrop), onclick: () => { state.backdrop = b.id; PB.$$('.pick', bp).forEach(x => x.setAttribute('aria-checked', String(x === btn))); } }, [sw, el('span', { text: b.name })]);
        bp.appendChild(btn);
      });
    }

    const hint = [s.welcome];
    if (PB.isDesktop && s.keyTrigger) hint.push('Or press the space bar.');
    $('#startHint').textContent = hint.filter(Boolean).join(' ');
    $('#btnStartLabel').textContent = state.mode === 'gif' ? 'Make a GIF' : 'Tap to start';
  }

  async function backdropList() {
    const out = PB.compose.BACKDROPS.map(b => ({ id: b.id, name: b.name }));
    try { (await PB.db.all('assets')).filter(a => a.kind === 'backdrop').forEach(a => out.push({ id: a.id, name: a.name || 'Custom', data: a.data })); } catch (e) { /* ignore */ }
    for (const b of out) {
      if (b.data) b.thumb = b.data;
      else { const c = PB.compose.drawBackdrop(b.id); const t = PB.makeCanvas(160, 120); t.getContext('2d').drawImage(c, 0, 0, 160, 120); b.thumb = t.toDataURL('image/jpeg', 0.8); }
    }
    return out;
  }
  PB.app.backdropList = backdropList;

  /* Attract-mode slideshow behind the start screen */
  let attractT = null;
  async function startAttract() {
    stopAttract();
    const box = $('#startSlides'); box.innerHTML = ''; box.classList.remove('on');
    if (!S().attractSlideshow) return;
    let recs = []; try { recs = (await PB.db.all('photos')).sort((a, b) => b.created - a.created).slice(0, 14); } catch (e) { return; }
    if (state.screen !== 'start' || !recs.length) return;
    const slides = recs.map(r => { const d = el('div', { class: 'slide' }); d.style.backgroundImage = `url("${r.thumb}")`; box.appendChild(d); return d; });
    box.classList.add('on');
    let i = 0; slides[0].classList.add('show');
    attractT = setInterval(() => { slides[i].classList.remove('show'); i = (i + 1) % slides.length; slides[i].classList.add('show'); }, 6000);
  }
  function stopAttract() { clearInterval(attractT); attractT = null; }

  /* ================= Capture session ================= */
  async function startSession() {
    if (state.busy) return;
    state.busy = true; PB.sound.unlock();
    const sid = ++state.sid;
    try { await PB.camera.ensureHotFolderPermission(); } catch (e) { state.busy = false; PB.toast(e.message, true); return; }
    resetCaptureUI(); show('capture');
    try { await PB.camera.start(); }
    catch (e) { state.busy = false; show('start'); await PB.alert('Camera problem', e.message || String(e)); return; }
    if (sid !== state.sid) return;
    const L = layout(); const gif = state.mode === 'gif';
    if (gif && !PB.camera.hasLivePreview()) { state.busy = false; show('start'); PB.toast('GIFs need a live camera preview. Turn on live view in Settings → Camera.', true); return; }
    const total = gif ? 1 : L.slots.length; const s = S();
    state.shots = []; state.gifFrames = []; $('#shotThumbs').innerHTML = '';
    try {
      for (let i = 0; i < total; i++) {
        if (sid !== state.sid) return;
        $('#shotPill').textContent = gif ? 'GIF time' : total > 1 ? `Photo ${i + 1} of ${total}` : 'Your photo';
        placeGuide(gif ? null : L.slots[i]);
        await PB.camera.arm();
        showPrompt();
        await countdown(i === 0 ? s.countdown : s.countdownNext, sid);
        if (sid !== state.sid) return;
        hidePrompt();
        if (gif) { state.gifFrames = await burst(sid); break; }
        const shot = await takeShot(sid);
        if (sid !== state.sid) return;
        state.shots.push(shot);
        const th = PB.compose.thumbOf(shot, 160);
        $('#shotThumbs').appendChild(el('img', { src: th, alt: '' }));
        if (i < total - 1 || s.reviewSeconds > 0) await instantReview(shot, s.reviewSeconds);
      }
    } catch (e) {
      if (sid !== state.sid) return;
      console.error(e); $('#waiting').hidden = true; state.busy = false;
      const again = await PB.confirm('That photo did not work', (e.message || String(e)) + ' Try again?', 'Try again');
      if (again) { state.busy = false; return startSession(); }
      show('start'); return;
    }
    if (sid !== state.sid) return;
    state.busy = false;
    await openReview();
  }
  PB.app.startSession = startSession;

  function cancelSession() {
    state.sid++; state.busy = false; hidePrompt(); $('#countdown').innerHTML = ''; $('#waiting').hidden = true;
    show('start');
  }

  function resetCaptureUI() {
    $('#countdown').innerHTML = ''; $('#waiting').hidden = true; $('#shotPill').textContent = '';
    $('#instantReview').classList.remove('show'); hidePrompt(); $('#frameGuide').style.display = 'none';
  }

  function placeGuide(slot) {
    const g = $('#frameGuide');
    if (!slot) { g.style.display = 'none'; return; }
    const W = innerWidth, H = innerHeight;
    let vw, vh; const v = PB.camera.video;
    if (PB.camera.kind === 'webcam' || (PB.camera.kind === 'hotfolder' && PB.camera.stream)) { vw = v.videoWidth; vh = v.videoHeight; }
    else { vw = PB.camera.previewAspect * 1000; vh = 1000; }
    if (!vw || !vh || !PB.camera.hasLivePreview()) { g.style.display = 'none'; return; }
    const rot = ((Number(S().camRotate) || 0) % 360 + 360) % 360; if (rot === 90 || rot === 270) [vw, vh] = [vh, vw];
    const s = Math.max(W / vw, H / vh); const dx = (W - vw * s) / 2, dy = (H - vh * s) / 2;
    const a = slot.w / slot.h; let cw, ch, cx, cy;
    if (vw / vh > a) { ch = vh; cw = vh * a; cx = (vw - cw) / 2; cy = 0; } else { cw = vw; ch = vw / a; cx = 0; cy = (vh - ch) * 0.42; }
    let left = dx + cx * s, top = dy + cy * s, w = cw * s, h = ch * s;
    const L2 = Math.max(0, left), T2 = Math.max(0, top), R2 = Math.min(W, left + w), B2 = Math.min(H, top + h);
    if ((R2 - L2) > W * 0.97 && (B2 - T2) > H * 0.97) { g.style.display = 'none'; return; }
    Object.assign(g.style, { display: 'block', left: L2 + 'px', top: T2 + 'px', width: (R2 - L2) + 'px', height: (B2 - T2) + 'px' });
  }

  let lastPrompt = -1;
  function showPrompt() {
    const s = S(); const p = $('#posePrompt');
    if (!s.posePrompts) { p.classList.remove('show'); return; }
    const list = String(s.poseList || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (!list.length) return;
    let i; do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === lastPrompt);
    lastPrompt = i; p.textContent = list[i]; p.classList.add('show');
  }
  function hidePrompt() { $('#posePrompt').classList.remove('show'); }

  async function countdown(n, sid) {
    const box = $('#countdown');
    for (let k = Math.max(0, Math.round(n)); k >= 1; k--) {
      if (sid !== state.sid) return;
      box.innerHTML = ''; box.appendChild(el('span', {}, String(k)));
      PB.sound.beep(k === 1 ? 990 : 660, 0.12);
      await PB.sleep(1000);
    }
    box.innerHTML = ''; box.appendChild(el('span', { class: 'word' }, 'Smile!'));
  }

  function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

  async function takeShot(sid) {
    const slow = PB.camera.isSlow();
    if (!slow) { flash(); PB.sound.shutter(); const c = await PB.camera.capture(); $('#countdown').innerHTML = ''; return c; }
    // DSLR: trigger/await the camera, then develop
    const p = PB.camera.capture();
    if (PB.camera.kind === 'digicam') { flash(); PB.sound.shutter(); }
    await PB.sleep(350);
    $('#countdown').innerHTML = '';
    $('#waitingText').textContent = PB.camera.kind === 'hotfolder' ? 'Waiting for the camera…' : 'Developing…';
    $('#waiting').hidden = false;
    try { return await p; } finally { if (sid === state.sid) $('#waiting').hidden = true; }
  }

  async function burst(sid) {
    const s = S(); const n = PB.clamp(Number(s.gifFrames) || 6, 3, 16); const frames = [];
    PB.sound.shutter();
    for (let i = 0; i < n; i++) {
      if (sid !== state.sid) return frames;
      const f = PB.camera.grabFrame(900); if (f) frames.push(f);
      $('#countdown').innerHTML = ''; $('#countdown').appendChild(el('span', { class: 'word' }, `${i + 1}/${n}`));
      flash();
      await PB.sleep(Math.max(120, (Number(s.gifDelay) || 140) * 1.4));
    }
    $('#countdown').innerHTML = '';
    if (frames.length < 2) throw new Error('The camera did not deliver enough frames for a GIF.');
    return frames;
  }

  async function instantReview(canvas, secs) {
    if (!secs) return;
    const im = $('#instantReview'); im.src = PB.compose.thumbOf(canvas, 900);
    await PB.sleep(30); im.classList.add('show');
    await PB.sleep(secs * 1000); im.classList.remove('show'); await PB.sleep(250);
  }

  /* ================= Review & decorate ================= */
  async function openReview() {
    const s = S();
    state.filter = s.filters ? (s.defaultFilter || 'none') : 'none';
    state.stickers = []; state.doodles = []; state.message = ''; state.record = null; state.dirty = true; state.finalCanvas = null; state.selSticker = null;
    state.gif = null;
    const isGif = state.mode === 'gif';
    show('review');
    buildTabs(isGif);
    $('#btnPrint').hidden = isGif || !s.printEnabled;
    $('#btnEmail').hidden = !s.emailEnabled;
    $('#btnShare').hidden = !s.shareEnabled;
    $('#btnShare').textContent = PB.isDesktop ? 'Save' : (PB.output.canShareFiles() ? 'Share' : 'Save');
    $('#btnPhone').hidden = !PB.output.phoneOn();
    const shown = PB.$$('#reviewActions .btn:not(.primary)').filter(b => !b.hidden);
    $('#btnRetake').classList.toggle('span2', shown.length % 2 === 1);
    if (isGif) await buildGif(); else await drawReview();
    PB.sound.tada(); PB.confetti(1800);
    armIdle();
  }

  function stageFit(aspect) {
    const stage = $('#reviewStage'); const r = stage.getBoundingClientRect();
    const maxW = r.width - 36, maxH = r.height - 36;
    let w = maxW, h = w / aspect; if (h > maxH) { h = maxH; w = h * aspect; }
    return { w: Math.max(50, Math.floor(w)), h: Math.max(50, Math.floor(h)) };
  }

  let drawQueued = false, drawing = false;
  async function drawReview() {
    if (drawing) { drawQueued = true; return; }
    drawing = true;
    try {
      const L = layout(); const fit = stageFit(L.width / L.height);
      const wrap = $('#printWrap'); wrap.style.width = fit.w + 'px'; wrap.style.height = fit.h + 'px';
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = Math.min(1, (fit.h * dpr) / L.height);
      $('#reviewCanvas').hidden = false; $('#reviewGif').hidden = true;
      await PB.compose.render(L, state.shots, { scale, filter: state.filter, extra: { message: state.message }, out: $('#reviewCanvas') });
      sizeDoodle(fit); renderStickers(); redrawDoodles();
    } finally { drawing = false; }
    if (drawQueued) { drawQueued = false; drawReview(); }
  }

  async function buildGif() {
    const wrap = $('#printWrap'); const img = $('#reviewGif');
    $('#reviewCanvas').hidden = true; img.hidden = false;
    $('#stickerLayer').innerHTML = ''; $('#doodleCanvas').getContext('2d').clearRect(0, 0, 9999, 9999);
    const res = await PB.compose.makeGif(state.gifFrames, { filter: state.filter });
    state.gif = res; state.dirty = true;
    const fit = stageFit(res.width / res.height); wrap.style.width = fit.w + 'px'; wrap.style.height = fit.h + 'px';
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    const url = URL.createObjectURL(res.blob); img.dataset.url = url; img.src = url;
  }

  function markDirty() { state.dirty = true; }

  /* ----- Tool tabs ----- */
  function buildTabs(isGif) {
    const s = S(); const tabs = [];
    if (s.filters) tabs.push(['filters', 'Filters']);
    if (!isGif && s.stickers) tabs.push(['stickers', 'Props']);
    if (!isGif && s.draw) tabs.push(['draw', 'Draw']);
    if (!isGif && s.messages) tabs.push(['message', 'Message']);
    const nav = $('#toolTabs'); const panels = $('#toolPanels'); nav.innerHTML = ''; panels.innerHTML = '';
    nav.hidden = tabs.length < 2;
    if (!tabs.length) { panels.appendChild(el('p', { class: 'panel-note', text: 'Looking great! Choose what to do with your photo below.' })); setTab(null); return; }
    tabs.forEach(([id, label]) => nav.appendChild(el('button', { role: 'tab', 'aria-selected': 'false', 'data-tab': id, onclick: () => setTab(id) }, label)));
    tabs.forEach(([id]) => panels.appendChild(el('div', { class: 'tool-panel', id: 'panel-' + id, hidden: true })));
    if (tabs.some(t => t[0] === 'filters')) buildFilterPanel(isGif);
    if (tabs.some(t => t[0] === 'stickers')) buildStickerPanel();
    if (tabs.some(t => t[0] === 'draw')) buildDrawPanel();
    if (tabs.some(t => t[0] === 'message')) buildMessagePanel();
    setTab(tabs[0][0]);
  }
  function setTab(id) {
    state.tab = id;
    PB.$$('#toolTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    PB.$$('#toolPanels .tool-panel').forEach(p => { p.hidden = p.id !== 'panel-' + id; });
    const drawingMode = id === 'draw';
    $('#doodleCanvas').classList.toggle('drawing', drawingMode);
    $('#stickerLayer').classList.toggle('locked', drawingMode);
    if (drawingMode) selectSticker(null);
  }

  function buildFilterPanel(isGif) {
    const p = $('#panel-filters'); const grid = el('div', { class: 'filter-grid' });
    const base = isGif ? state.gifFrames[0] : state.shots[0];
    PB.compose.FILTERS.forEach(f => {
      const img = el('img', { alt: '' });
      const b = el('button', { 'aria-pressed': String(state.filter === f.id), onclick: async () => {
        if (state.filter === f.id) return;
        state.filter = f.id; markDirty();
        PB.$$('button', grid).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        if (isGif) { PB.toast('Updating your GIF…'); await buildGif(); } else drawReview();
      } }, [img, f.name]);
      grid.appendChild(b);
      setTimeout(() => { if (base) img.src = PB.compose.preparePhoto(base, 140, 140, f.id).toDataURL('image/jpeg', 0.8); }, 0);
    });
    p.appendChild(grid);
  }

  /* ----- Stickers (props + text) ----- */
  function buildStickerPanel() {
    const p = $('#panel-stickers'); const grid = el('div', { class: 'sticker-grid' });
    STICKERS.forEach(e => grid.appendChild(el('button', { 'aria-label': 'Add ' + e, onclick: () => addSticker({ type: 'emoji', content: e }) }, e)));
    p.appendChild(grid);
    p.appendChild(el('p', { class: 'panel-note', text: PB.isTouch ? 'Drag props into place. Pinch with two fingers to resize and turn.' : 'Drag props into place. Use the round buttons to resize, turn or remove.' }));
  }
  function addSticker(st) {
    const s = Object.assign({ id: PB.uid(), x: 0.5 + (Math.random() - 0.5) * 0.1, y: 0.42 + (Math.random() - 0.5) * 0.1, size: st.type === 'text' ? 0.09 : 0.16, rot: 0 }, st);
    state.stickers.push(s); markDirty(); renderStickers(); selectSticker(s.id);
  }
  function renderStickers() {
    const layer = $('#stickerLayer'); const W = layer.clientWidth, H = layer.clientHeight;
    layer.innerHTML = '';
    state.stickers.forEach(st => {
      const n = el('div', { class: 'stk' + (st.type === 'text' ? ' text' : '') + (st.id === state.selSticker ? ' sel' : ''), 'data-id': st.id }, st.content);
      n.style.fontSize = (st.size * W) + 'px';
      if (st.type === 'text') { n.style.fontFamily = PB.fontStack(st.font); n.style.color = st.color; n.style.fontStyle = PB.fontStyleFor(st.font) ? 'italic' : ''; n.style.webkitTextStroke = `${st.size * W * 0.08}px ${st.outline || '#fff'}`; n.style.paintOrder = 'stroke fill'; }
      else n.style.fontFamily = PB.compose.EMOJI_FONT;
      n.style.transform = `translate(${st.x * W}px, ${st.y * H}px) translate(-50%, -50%) rotate(${st.rot}deg)`;
      attachStickerDrag(n, st);
      layer.appendChild(n);
    });
    if (state.selSticker) drawStickerTools();
  }
  function selectSticker(id) { state.selSticker = id; renderStickers(); }
  function drawStickerTools() {
    const layer = $('#stickerLayer'); const st = state.stickers.find(x => x.id === state.selSticker); if (!st) return;
    const W = layer.clientWidth, H = layer.clientHeight;
    const tools = el('div', { class: 'stk-tools' }, [
      ['−', 'Smaller', () => { st.size = Math.max(0.03, st.size * 0.85); }], ['+', 'Bigger', () => { st.size = Math.min(0.9, st.size * 1.18); }],
      ['⟲', 'Turn left', () => { st.rot -= 15; }], ['⟳', 'Turn right', () => { st.rot += 15; }],
      ['✕', 'Remove', () => { state.stickers = state.stickers.filter(x => x !== st); state.selSticker = null; }],
    ].map(([t, label, fn]) => el('button', { 'aria-label': label, title: label, onpointerdown: e => e.stopPropagation(), onclick: e => { e.stopPropagation(); fn(); markDirty(); renderStickers(); armIdle(); } }, t)));
    const below = Math.min(H - 52, st.y * H + st.size * W * 0.6);
    tools.style.left = PB.clamp(st.x * W, 110, W - 110) + 'px'; tools.style.top = Math.max(0, below) + 'px';
    layer.appendChild(tools);
  }
  function attachStickerDrag(node, st) {
    const pts = new Map(); let start = null;
    node.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (state.selSticker !== st.id) { state.selSticker = st.id; PB.$$('.stk', node.parentNode).forEach(n => n.classList.toggle('sel', n === node)); PB.$$('.stk-tools', node.parentNode).forEach(t => t.remove()); }
      node.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = snapshot();
    });
    function snapshot() {
      const arr = Array.from(pts.values());
      const c = arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
      const d = arr.length > 1 ? Math.hypot(arr[1].x - arr[0].x, arr[1].y - arr[0].y) : 0;
      const ang = arr.length > 1 ? Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x) : 0;
      return { c, d, ang, x: st.x, y: st.y, size: st.size, rot: st.rot, n: arr.length };
    }
    node.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = snapshot(); if (now.n !== start.n) { start = now; return; }
      const layer = $('#stickerLayer'); const W = layer.clientWidth, H = layer.clientHeight;
      st.x = PB.clamp(start.x + (now.c.x - start.c.x) / W, 0, 1); st.y = PB.clamp(start.y + (now.c.y - start.c.y) / H, 0, 1);
      if (now.n > 1 && start.d > 0) { st.size = PB.clamp(start.size * now.d / start.d, 0.03, 0.9); st.rot = start.rot + (now.ang - start.ang) * 180 / Math.PI; }
      node.style.fontSize = (st.size * W) + 'px';
      node.style.transform = `translate(${st.x * W}px, ${st.y * H}px) translate(-50%, -50%) rotate(${st.rot}deg)`;
      markDirty();
    });
    const end = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); start = snapshot(); if (!pts.size) renderStickers(); armIdle(); };
    node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  }

  /* ----- Draw ----- */
  let brush = { color: '#C8203B', width: 0.012 };
  function buildDrawPanel() {
    const p = $('#panel-draw');
    const sw = el('div', { class: 'swatches' }, INK_COLORS.map(c => el('button', { style: { background: c }, 'aria-label': 'Colour ' + c, 'aria-pressed': String(brush.color === c), onclick: e => { brush.color = c; PB.$$('button', sw).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));
    const sizes = el('div', { class: 'row' }, [['Thin', 0.006], ['Medium', 0.012], ['Thick', 0.024]].map(([l, w]) => el('button', { class: 'btn small' + (brush.width === w ? ' primary' : ''), onclick: e => { brush.width = w; PB.$$('button', sizes).forEach(b => b.classList.toggle('primary', b === e.currentTarget)); } }, l)));
    const acts = el('div', { class: 'row', style: { marginTop: '12px' } }, [
      el('button', { class: 'btn small', onclick: () => { state.doodles.pop(); markDirty(); redrawDoodles(); } }, 'Undo'),
      el('button', { class: 'btn small', onclick: () => { state.doodles = []; markDirty(); redrawDoodles(); } }, 'Clear drawing'),
    ]);
    p.append(sw, sizes, acts, el('p', { class: 'panel-note', text: 'Draw right on your photo with a finger or the mouse.' }));
  }
  function sizeDoodle(fit) {
    const c = $('#doodleCanvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(fit.w * dpr); c.height = Math.round(fit.h * dpr);
  }
  function redrawDoodles() {
    const c = $('#doodleCanvas'); const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    state.doodles.forEach(d => { ctx.strokeStyle = d.color; ctx.lineWidth = d.width * c.width; ctx.beginPath(); d.pts.forEach((p, i) => i ? ctx.lineTo(p[0] * c.width, p[1] * c.height) : ctx.moveTo(p[0] * c.width, p[1] * c.height)); if (d.pts.length === 1) ctx.lineTo(d.pts[0][0] * c.width + 0.1, d.pts[0][1] * c.height); ctx.stroke(); });
  }
  function bindDoodle() {
    const c = $('#doodleCanvas'); let cur = null;
    const pt = e => { const r = c.getBoundingClientRect(); return [PB.clamp((e.clientX - r.left) / r.width, 0, 1), PB.clamp((e.clientY - r.top) / r.height, 0, 1)]; };
    c.addEventListener('pointerdown', e => { if (state.tab !== 'draw') return; e.preventDefault(); c.setPointerCapture(e.pointerId); cur = { color: brush.color, width: brush.width, pts: [pt(e)] }; state.doodles.push(cur); markDirty(); redrawDoodles(); });
    c.addEventListener('pointermove', e => { if (!cur) return; cur.pts.push(pt(e)); redrawDoodles(); });
    const end = () => { cur = null; armIdle(); };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }

  /* ----- Message ----- */
  function buildMessagePanel() {
    const p = $('#panel-message');
    const ta = el('textarea', { class: 'msg-input', rows: 2, maxlength: 60, placeholder: 'Happy birthday, Grandma!' });
    let font = 'Handwritten', color = '#1D1B2E';
    const fonts = el('div', { class: 'row', style: { margin: '10px 0' } }, [['Handwritten', 'Handwritten'], ['Script', 'Fancy'], ['Display', 'Bold'], ['Rounded', 'Simple']].map(([f, l]) => el('button', { class: 'btn small' + (f === font ? ' primary' : ''), style: { fontFamily: PB.fontStack(f) }, onclick: e => { font = f; PB.$$('button', fonts).forEach(b => b.classList.toggle('primary', b === e.currentTarget)); } }, l)));
    const sw = el('div', { class: 'swatches' }, INK_COLORS.map(c => el('button', { style: { background: c }, 'aria-label': 'Colour ' + c, 'aria-pressed': String(c === color), onclick: e => { color = c; PB.$$('button', sw).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));
    const add = el('button', { class: 'btn primary', style: { width: '100%' }, onclick: () => {
      const txt = ta.value.trim(); if (!txt) { ta.focus(); return; }
      state.message = txt; addSticker({ type: 'text', content: txt, font, color, outline: color === '#FFFFFF' ? '#1D1B2E' : '#FFFFFF', y: 0.85 });
      ta.value = ''; PB.toast('Message added. Drag it where you like.');
    } }, 'Add to photo');
    p.append(ta, fonts, sw, add, el('p', { class: 'panel-note', text: 'Messages are saved in the guest book with your photo.' }));
  }

  /* ================= Finalize & actions ================= */
  async function finalize() {
    if (state.record && !state.dirty) return state.record;
    const L = layout(); let blob, thumb, w, h;
    if (state.mode === 'gif') {
      blob = state.gif.blob; thumb = PB.compose.thumbOf(state.gif.preview); w = state.gif.width; h = state.gif.height; state.finalCanvas = null;
    } else {
      const c = await PB.compose.render(L, state.shots, { scale: 1, filter: state.filter, stickers: state.stickers, doodles: state.doodles, extra: { message: state.message } });
      blob = await PB.canvasToBlob(c, 'image/jpeg', 0.93); thumb = PB.compose.thumbOf(c); w = c.width; h = c.height; state.finalCanvas = c;
    }
    const rec = state.record || { id: PB.uid(), created: Date.now(), prints: 0, emails: [] };
    Object.assign(rec, { kind: state.mode === 'gif' ? 'gif' : 'card', blob, thumb, layoutId: L.id, layoutName: state.mode === 'gif' ? 'GIF' : L.name, width: w, height: h, message: state.message || '', savedToDisk: null });
    await PB.output.saveRecord(rec);
    state.record = rec; state.dirty = false;
    return rec;
  }

  async function canvasForRecord(rec) {
    const bmp = await PB.camera.decode(rec.blob);
    const c = PB.makeCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); return c;
  }

  function askCopies() {
    const max = Math.max(1, Number(S().maxCopies) || 1);
    if (max === 1) return Promise.resolve(1);
    return new Promise(res => {
      let n = 1, m; const out = el('output', {}, '1');
      const set = v => { n = PB.clamp(v, 1, max); out.textContent = n; };
      m = PB.modal([
        el('h3', { text: 'How many prints?', style: { textAlign: 'center' } }),
        el('div', { class: 'stepper' }, [el('button', { 'aria-label': 'Fewer', onclick: () => set(n - 1) }, '−'), out, el('button', { 'aria-label': 'More', onclick: () => set(n + 1) }, '+')]),
        el('div', { class: 'modal-actions', style: { justifyContent: 'center' } }, [el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), el('button', { class: 'btn primary', onclick: () => { res(n); m.close(true); } }, 'Print')]),
      ], { onClose: v => { if (!v) res(0); } });
    });
  }

  async function doPrint(rec, canvas, copies) {
    if (!copies) copies = await askCopies();
    if (!copies) return false;
    try {
      PB.toast(copies > 1 ? `Printing ${copies} copies…` : 'Printing…');
      await PB.output.print(canvas || await canvasForRecord(rec), copies);
      rec.prints = (rec.prints || 0) + copies; await PB.db.put('photos', rec);
      PB.confetti(1600);
      return true;
    } catch (e) { PB.toast('Print failed: ' + (e.message || e), true); return false; }
  }
  PB.app.doPrint = doPrint;

  /* Email entry with optional on-screen keyboard */
  function askEmails() {
    return new Promise(res => {
      let m;
      const input = el('input', { type: 'email', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'you@example.com', autofocus: true, inputmode: 'email' });
      const err = el('p', { style: { color: 'var(--danger)', margin: '8px 0 0', minHeight: '1.4em' } });
      const submit = () => {
        const list = input.value.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
        const bad = list.filter(x => !PB.validEmail(x));
        if (!list.length) { err.textContent = 'Type an email address.'; return; }
        if (bad.length) { err.textContent = `Check this address: ${bad[0]}`; return; }
        res(list.slice(0, 5)); m.close(true);
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      const osk = useOSK() ? buildOSK(input) : null;
      if (osk) input.setAttribute('inputmode', 'none');
      m = PB.modal([
        el('h3', { text: 'Where should we send it?' }),
        el('p', { text: 'Add more than one address with commas.' }),
        input, err, osk,
        el('div', { class: 'modal-actions' }, [el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), el('button', { class: 'btn primary', onclick: submit }, 'Send')]),
      ], { wide: !!osk, onClose: v => { if (!v) res(null); } });
    });
  }
  function useOSK() { const o = S().osk || 'auto'; return o === 'on' || (o === 'auto' && PB.isDesktop); }
  function buildOSK(input) {
    const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const extra = ['@', '.', '_', '-', '.com', '@gmail.com', '@yahoo.com', '@outlook.com', '@icloud.com'];
    const type = t => { input.value += t; input.dispatchEvent(new Event('input')); };
    const key = (t, label, grow) => el('button', { class: 'btn small', style: { flex: grow ? '2 1 0' : '1 1 0', minWidth: '0', padding: '6px 2px' }, onclick: e => { e.preventDefault(); type(t); } }, label || t);
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' } });
    rows.forEach(r => wrap.appendChild(el('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '6px' } }, r.split('').map(ch => key(ch)))));
    const wide = t => el('button', { class: 'btn small', style: { flex: '1 1 auto', whiteSpace: 'nowrap', padding: '6px 10px' }, onclick: e => { e.preventDefault(); type(t); } }, t);
    wrap.appendChild(el('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '6px' } }, extra.filter(x => x.length <= 4).map(x => key(x))
      .concat([el('button', { class: 'btn small', style: { flex: '2 1 0', whiteSpace: 'nowrap' }, onclick: e => { e.preventDefault(); input.value = input.value.slice(0, -1); } }, '⌫ Delete'), el('button', { class: 'btn small', style: { flex: '1.4 1 0' }, onclick: e => { e.preventDefault(); input.value = ''; } }, 'Clear')])));
    wrap.appendChild(el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, extra.filter(x => x.length > 4).map(wide)));
    return wrap;
  }

  async function doEmail(rec) {
    const list = await askEmails(); if (!list) return;
    PB.toast('Sending…');
    const results = await PB.output.email(rec, list);
    const sent = results.filter(r => r.status === 'sent').length;
    if (sent === results.length) PB.toast(sent > 1 ? `Sent to ${sent} addresses` : `Sent to ${list[0]}`);
    else PB.toast('Saved. We’ll email it after the party.');
  }
  PB.app.doEmail = doEmail;

  async function actionPrint() { armIdle(); const rec = await finalize(); await doPrint(rec, state.finalCanvas); armIdle(); }
  async function actionEmail() { armIdle(); const rec = await finalize(); await doEmail(rec); armIdle(); }
  async function actionPhone() { armIdle(); const rec = await finalize(); await PB.output.showPhoneQR(rec); armIdle(); }
  async function actionShare() { armIdle(); const rec = await finalize(); const r = await PB.output.share(rec); if (r === 'downloaded' && !PB.isDesktop) PB.toast('Saved to downloads'); armIdle(); }
  async function actionDone(auto) {
    clearIdle();
    try {
      const rec = await finalize();
      const s = S();
      if (s.autoPrint && s.printEnabled && rec.kind === 'card' && !(rec.prints > 0)) await doPrint(rec, state.finalCanvas, Math.max(1, Number(s.autoPrintCopies) || 1));
      if (!auto) PB.toast('Saved to the gallery');
    } catch (e) { PB.toast('Could not save: ' + (e.message || e), true); }
    show('start');
  }
  async function actionRetake() {
    clearIdle();
    if (state.record || state.stickers.length || state.doodles.length) { if (!(await PB.confirm('Start over?', 'Your decorations on this photo will be lost.', 'Retake'))) { armIdle(); return; } }
    startSession();
  }

  function armIdle() {
    clearIdle(); const secs = Number(S().idleSeconds) || 0;
    if (state.screen === 'review' && secs > 0) state.idleT = setTimeout(() => { if (!document.querySelector('.modal-back')) actionDone(true); else armIdle(); }, secs * 1000);
  }
  function clearIdle() { clearTimeout(state.idleT); state.idleT = null; }

  /* ================= Gallery ================= */
  const urls = [];
  function freeUrls() { while (urls.length) URL.revokeObjectURL(urls.pop()); }
  async function openGallery() {
    if (!S().guestGallery && !(await PB.askPin('Host PIN for the gallery'))) return;
    PB.camera.stop(); show('gallery'); await renderGallery();
  }
  async function renderGallery() {
    freeUrls();
    const grid = $('#galleryGrid'); grid.innerHTML = '';
    const recs = (await PB.db.all('photos')).sort((a, b) => b.created - a.created);
    $('#galleryTitle').textContent = recs.length ? `${recs.length} photo${recs.length === 1 ? '' : 's'}` : 'Photos';
    if (!recs.length) { grid.appendChild(el('div', { class: 'empty', text: 'No photos yet. Take the first one!' })); return; }
    recs.forEach(r => grid.appendChild(el('button', { class: 'g-item', 'aria-label': 'Open photo', onclick: () => openViewer(r) }, [el('img', { src: r.thumb, alt: '', loading: 'lazy' }), r.kind === 'gif' ? el('span', { class: 'badge', text: 'GIF' }) : null])));
  }
  function openViewer(rec) {
    const url = URL.createObjectURL(rec.blob); urls.push(url);
    const s = S(); let m;
    const when = new Date(rec.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const bits = [when]; if (rec.prints) bits.push(`${rec.prints} printed`); if ((rec.emails || []).length) bits.push(`${rec.emails.length} email${rec.emails.length > 1 ? 's' : ''}`);
    const acts = [];
    if (rec.kind === 'card' && s.printEnabled) acts.push(el('button', { class: 'btn', onclick: () => doPrint(rec) }, 'Print'));
    if (s.emailEnabled) acts.push(el('button', { class: 'btn', onclick: () => doEmail(rec) }, 'Email'));
    if (s.shareEnabled) acts.push(el('button', { class: 'btn', onclick: () => PB.output.share(rec) }, PB.isDesktop ? 'Save' : 'Share'));
    if (PB.output.phoneOn()) acts.push(el('button', { class: 'btn', onclick: () => PB.output.showPhoneQR(rec) }, 'Phone'));
    acts.push(el('button', { class: 'btn danger', onclick: async () => {
      if (!(await PB.askPin('Host PIN to delete'))) return;
      if (!(await PB.confirm('Delete this photo?', 'It will be removed from the gallery on this device.', 'Delete', true))) return;
      await PB.db.del('photos', rec.id); m.close(); renderGallery();
    } }, 'Delete'));
    acts.push(el('button', { class: 'btn primary', onclick: () => m.close() }, 'Close'));
    m = PB.modal(el('div', { class: 'viewer' }, [
      el('img', { src: url, alt: 'Photo' }),
      el('div', { class: 'meta', text: bits.join('   ') }),
      rec.message ? el('div', { class: 'meta', text: `“${rec.message}”` }) : null,
      el('div', { class: 'modal-actions', style: { justifyContent: 'center' } }, acts),
    ]), { wide: true });
  }

  /* ================= Slideshow ================= */
  let ssT = null;
  async function slideshow() {
    const recs = (await PB.db.all('photos')).sort((a, b) => a.created - b.created);
    if (!recs.length) { PB.toast('No photos yet.'); return; }
    const box = $('#slideshow'); box.innerHTML = ''; box.hidden = false;
    const a = el('img', { alt: '' }), b = el('img', { alt: '' });
    const cap = el('div', { class: 'ss-caption', text: [S().eventName, S().hashtag].filter(Boolean).join('   ') });
    box.append(a, b, cap);
    let i = 0, front = a; const local = [];
    const next = async () => {
      const list = (await PB.db.all('photos')).sort((x, y) => x.created - y.created);
      const r = list[i % list.length]; i++;
      const u = URL.createObjectURL(r.blob); local.push(u); if (local.length > 4) URL.revokeObjectURL(local.shift());
      const back = front === a ? b : a; back.src = u;
      await (back.decode ? back.decode().catch(() => {}) : PB.sleep(100));
      back.classList.add('show'); front.classList.remove('show'); front = back;
    };
    await next(); ssT = setInterval(next, 5000);
    const exit = () => { clearInterval(ssT); box.hidden = true; box.innerHTML = ''; local.forEach(u => URL.revokeObjectURL(u)); box.removeEventListener('pointerdown', exit); document.removeEventListener('keydown', exit); };
    setTimeout(() => { box.addEventListener('pointerdown', exit); document.addEventListener('keydown', exit); }, 300);
    try { if (!document.fullscreenElement && box.requestFullscreen) await box.requestFullscreen(); } catch (e) { /* optional */ }
  }

  /* ================= Misc ================= */
  let wakeLock = null;
  async function keepAwake() {
    if (!S().keepAwake || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ }
  }
  async function toggleFullscreen() {
    if (PB.native && PB.native.setFullscreen) { PB.native.setFullscreen(); return; }
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (e) { PB.toast('Full screen is not available here. On a phone, add the booth to your home screen.'); }
  }

  async function openSettings() {
    if (!(await PB.askPin())) return;
    PB.camera.stop(); show('settings'); PB.settingsUI.open();
  }
  PB.app.refresh = () => { PB.layouts.clearThumbs(); if (state.screen === 'start') renderStart(); };

  function bind() {
    $('#btnStart').addEventListener('click', startSession);
    $('#btnCancel').addEventListener('click', cancelSession);
    $('#btnGallery').addEventListener('click', openGallery);
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnFullscreen').addEventListener('click', toggleFullscreen);
    $('#btnRetake').addEventListener('click', actionRetake);
    $('#btnPrint').addEventListener('click', actionPrint);
    $('#btnEmail').addEventListener('click', actionEmail);
    $('#btnShare').addEventListener('click', actionShare);
    $('#btnPhone').addEventListener('click', actionPhone);
    $('#btnDone').addEventListener('click', () => actionDone(false));
    $('#btnGalleryBack').addEventListener('click', () => { freeUrls(); show('start'); });
    $('#btnSlideshow').addEventListener('click', slideshow);
    $('#btnExportAll').addEventListener('click', async () => {
      if (!(await PB.askPin())) return;
      try { PB.toast('Packing photos…'); const z = await PB.output.exportAll(); await PB.download(z, `${PB.slug(S().eventName)}-photos-${PB.fileStamp()}.zip`); } catch (e) { PB.toast(e.message, true); }
    });
    $('#stickerLayer').addEventListener('pointerdown', e => { if (e.target.id === 'stickerLayer') selectSticker(null); });
    $('#screen-review').addEventListener('pointerdown', armIdle, true);
    bindDoodle();
    document.addEventListener('keydown', e => {
      if (document.querySelector('.modal-back') || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      const go = [' ', 'Enter', 'PageDown', 'ArrowRight', 'b', 'B'].includes(e.key);
      if (state.screen === 'start' && S().keyTrigger && go) { e.preventDefault(); startSession(); }
      else if (state.screen === 'review' && (e.key === 'Enter' || e.key === 'PageDown')) { e.preventDefault(); actionDone(false); }
      else if (state.screen === 'capture' && e.key === 'Escape') cancelSession();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') keepAwake();
      else if (state.screen !== 'capture') PB.camera.stop();
    });
    let rz = null;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (state.screen === 'review') { if (state.mode === 'gif' && state.gif) { const f = stageFit(state.gif.width / state.gif.height); Object.assign($('#printWrap').style, { width: f.w + 'px', height: f.h + 'px' }); } else drawReview(); } }, 150); });
  }

  async function init() {
    PB.camera.bind();
    await PB.loadSettings();
    if (!PB.settings.relaySecret) { PB.settings.relaySecret = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10); PB.saveSettings(); }
    await PB.layouts.load();
    await PB.camera.restoreHotFolder();
    state.backdrop = PB.settings.gsBackdrop;
    state.layoutId = PB.settings.defaultLayout;
    bind();
    show('start');
    keepAwake();
    PB.ensureFonts().then(() => { PB.layouts.clearThumbs(); if (state.screen === 'start') renderStart(); });
    if (PB.isDesktop && PB.settings.kioskMode && PB.native.setKiosk) PB.native.setKiosk(true);
    if (PB.output.phoneOn()) PB.output.startPhoneServer().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  document.addEventListener('DOMContentLoaded', () => init().catch(e => { console.error(e); PB.toast('Startup problem: ' + e.message, true, 8000); }));
})(window.PB);
