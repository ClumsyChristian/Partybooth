/* PartyBooth — host settings screen */
'use strict';
(function (PB) {
  const $ = PB.$, el = PB.el;
  const ui = { section: 'event' };
  PB.settingsUI = ui;

  const SECTIONS = [
    ['event', 'Event & look'], ['session', 'Guest experience'], ['camera', 'Camera'], ['layouts', 'Card layouts'],
    ['print', 'Printing'], ['email', 'Email & sharing'], ['kiosk', 'Kiosk & security'], ['data', 'Photos & backup'],
  ];

  ui.open = function (section) {
    if (section) ui.section = section;
    $('#envBadge').textContent = PB.isDesktop ? 'Windows desktop app' : 'Browser version';
    const nav = $('#settingsNav'); nav.innerHTML = '';
    SECTIONS.forEach(([id, label]) => nav.appendChild(el('button', { 'aria-current': String(id === ui.section), onclick: () => { ui.section = id; ui.open(); } }, label)));
    renderSection();
  };

  function renderSection() {
    const c = $('#settingsContent'); c.innerHTML = ''; c.scrollTop = 0;
    const fn = { event: secEvent, session: secSession, camera: secCamera, layouts: secLayouts, print: secPrint, email: secEmail, kiosk: secKiosk, data: secData }[ui.section];
    fn(c);
  }
  const rerender = () => { const top = $('#settingsContent').scrollTop; renderSection(); $('#settingsContent').scrollTop = top; };
  function set(key, v) { PB.settings[key] = v; PB.saveSettings(); PB.layouts.clearThumbs(); }

  /* ---------- Field builders ---------- */
  function lbl(label, help) { return el('div', { class: 'lbl' }, [el('b', { text: label }), help ? el('small', { text: help }) : null]); }
  function toggle(key, label, help, opts = {}) {
    const get = opts.get || (() => !!PB.settings[key]);
    const inp = el('input', { type: 'checkbox', checked: get(), 'aria-label': label });
    inp.addEventListener('change', () => { opts.setter ? opts.setter(inp.checked) : set(key, inp.checked); if (opts.rerender) rerender(); opts.after && opts.after(inp.checked); });
    return el('label', { class: 'field' }, [lbl(label, help), el('span', { class: 'switch' }, [inp, el('span')])]);
  }
  function text(key, label, help, opts = {}) {
    const inp = el('input', { type: opts.type || 'text', value: PB.settings[key] == null ? '' : PB.settings[key], placeholder: opts.placeholder || '', autocomplete: 'off', 'aria-label': label });
    if (opts.inputmode) inp.setAttribute('inputmode', opts.inputmode);
    inp.addEventListener('input', () => { set(key, inp.value); opts.after && opts.after(inp.value); });
    return el('div', { class: 'field' + (opts.stack ? ' stack' : '') }, [lbl(label, help), inp]);
  }
  function number(key, label, help, min, max, step = 1, opts = {}) {
    const inp = el('input', { type: 'number', min, max, step, value: PB.settings[key], 'aria-label': label });
    inp.addEventListener('change', () => { let v = parseFloat(inp.value); if (isNaN(v)) v = PB.DEFAULTS[key]; v = PB.clamp(v, min, max); inp.value = v; set(key, v); opts.after && opts.after(v); });
    return el('div', { class: 'field' }, [lbl(label, help), inp]);
  }
  function select(key, label, options, help, opts = {}) {
    const sel = el('select', { 'aria-label': label });
    options.forEach(([v, l]) => sel.appendChild(el('option', { value: v, selected: String(PB.settings[key]) === String(v) }, l)));
    sel.addEventListener('change', () => { const v = typeof PB.DEFAULTS[key] === 'number' ? Number(sel.value) : sel.value; set(key, v); if (opts.rerender) rerender(); opts.after && opts.after(v); });
    return el('div', { class: 'field' }, [lbl(label, help), sel]);
  }
  function textarea(key, label, help) {
    const ta = el('textarea', { 'aria-label': label }); ta.value = PB.settings[key] || '';
    ta.addEventListener('input', () => set(key, ta.value));
    return el('div', { class: 'field stack' }, [lbl(label, help), ta]);
  }
  function color(key, label, help) {
    const inp = el('input', { type: 'color', value: PB.settings[key], 'aria-label': label });
    inp.addEventListener('input', () => set(key, inp.value));
    return el('div', { class: 'field' }, [lbl(label, help), inp]);
  }
  function custom(label, help, control) { return el('div', { class: 'field' }, [lbl(label, help), control]); }
  function group(title, children) { return el('div', { class: 'group' }, [title ? el('h4', { text: title }) : null].concat(children.filter(Boolean))); }
  function head(c, title, lead) { c.append(el('h3', { text: title }), lead ? el('p', { class: 'lead', text: lead }) : null); }
  function note(html, ok) { return el('div', { class: 'note' + (ok ? ' ok' : ''), html }); }
  function btn(label, onclick, cls = '') { return el('button', { class: 'btn small ' + cls, onclick }, label); }

  /* ---------- Event & look ---------- */
  function secEvent(c) {
    head(c, 'Event & look', 'What guests see on the start screen and on every card.');
    c.appendChild(group('', [
      text('eventName', 'Event name', 'Shown on the sign and printed on cards. Example: Maya turns 7!'),
      text('eventSub', 'Line under the name', 'Use {date} for today’s date.'),
      text('hashtag', 'Hashtag', 'Optional, printed on cards that include it. Example: #MayaTurns7'),
      text('welcome', 'Welcome message', 'Short instructions under the start button.'),
    ]));
    const bgSel = el('select', { 'aria-label': 'Start screen background' });
    [['curtain', 'Red booth curtain'], ['ink', 'Dark night'], ['image', 'My own picture']].forEach(([v, l]) => bgSel.appendChild(el('option', { value: v, selected: PB.settings.startStyle === v }, l)));
    bgSel.addEventListener('change', async () => {
      if (bgSel.value === 'image') {
        const f = await PB.pickFile('image/*'); if (!f) { bgSel.value = PB.settings.startStyle; return; }
        const img = await PB.loadImage(await PB.blobToDataURL(f)); const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = PB.makeCanvas(img.naturalWidth * s, img.naturalHeight * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        await PB.db.put('assets', { id: 'startBg', kind: 'startBg', data: cv.toDataURL('image/jpeg', 0.88) });
      }
      set('startStyle', bgSel.value);
    });
    c.appendChild(group('Look', [
      color('accent', 'Sign colour', 'Colour of the lit-up sign and countdown.'),
      custom('Start screen background', null, bgSel),
      toggle('attractSlideshow', 'Show recent photos behind the start screen', 'A soft slideshow of the party so far.'),
    ]));
    c.appendChild(group('What guests can make', [
      toggle('photo', 'Photo cards', 'Prints and digital cards using your layouts.', { get: () => !!PB.settings.modes.photo, setter: v => { PB.settings.modes.photo = v; if (!v && !PB.settings.modes.gif) PB.settings.modes.gif = true; PB.saveSettings(); }, rerender: true }),
      toggle('gif', 'Animated GIFs', 'A quick burst of shots that loops back and forth. Great for sharing, not printed.', { get: () => !!PB.settings.modes.gif, setter: v => { PB.settings.modes.gif = v; if (!v && !PB.settings.modes.photo) PB.settings.modes.photo = true; PB.saveSettings(); }, rerender: true }),
      PB.settings.modes.gif ? number('gifFrames', 'GIF frames', 'How many shots in the burst.', 3, 16) : null,
      PB.settings.modes.gif ? number('gifDelay', 'GIF speed (ms per frame)', 'Lower is faster.', 60, 600, 10) : null,
      PB.settings.modes.gif ? toggle('gifBoomerang', 'Boomerang', 'Play forward then backward.') : null,
      PB.settings.modes.gif ? select('gifSize', 'GIF size', [[360, 'Small (fast to send)'], [540, 'Medium'], [720, 'Large']]) : null,
    ]));
  }

  /* ---------- Guest experience ---------- */
  function secSession(c) {
    head(c, 'Guest experience', 'Timing and the fun extras guests get after the photos.');
    c.appendChild(group('Countdown', [
      number('countdown', 'First countdown (seconds)', null, 0, 15),
      number('countdownNext', 'Between photos (seconds)', null, 0, 10),
      number('reviewSeconds', 'Show each photo for (seconds)', 'Quick look after each shot. 0 to skip.', 0, 5, 0.2),
      toggle('sounds', 'Sounds', 'Countdown beeps and a shutter click.'),
    ]));
    c.appendChild(group('Pose ideas', [
      toggle('posePrompts', 'Show a fun pose idea during each countdown', null),
      textarea('poseList', 'Pose ideas', 'One per line. A random one is picked for each photo.'),
    ]));
    c.appendChild(group('Decorating', [
      toggle('filters', 'Filters', 'Black & white, vintage, pop and more.', { rerender: true }),
      PB.settings.filters ? select('defaultFilter', 'Starting filter', PB.compose.FILTERS.map(f => [f.id, f.name])) : null,
      toggle('stickers', 'Props and stickers', 'Crowns, glasses, hearts and more to drag onto the card.'),
      toggle('draw', 'Drawing', 'Doodle on the card with a finger or mouse.'),
      toggle('messages', 'Guest book messages', 'Guests can write a note on their card. Saved with the photo.'),
      toggle('confetti', 'Confetti celebration', null),
    ]));
    c.appendChild(group('After the photo', [
      toggle('guestGallery', 'Guests can open the gallery', 'Turn off to require the host PIN.'),
      number('idleSeconds', 'Return to the start screen after (seconds)', 'If nobody touches the screen. The photo is saved first. 0 = never.', 0, 600, 5),
    ]));
  }

  /* ---------- Camera ---------- */
  async function deviceOptions(includeNone) {
    const opts = includeNone ? [['', 'No live preview']] : [['', 'Front camera (phones & tablets) / default'], ['env', 'Back camera (phones & tablets)']];
    try { (await PB.camera.listDevices()).forEach(d => opts.push([d.deviceId, d.label])); } catch (e) { /* no permission */ }
    return opts;
  }
  function secCamera(c) {
    const S = PB.settings;
    head(c, 'Camera', 'Use the built-in camera, a USB webcam, or a DSLR / mirrorless camera.');
    const sources = [['webcam', 'Camera or webcam (also DSLRs via a webcam utility or HDMI capture card)'], ['hotfolder', 'DSLR with tethering software (watch a folder for new photos)']];
    if (PB.isDesktop) sources.push(['digicam', 'DSLR controlled by digiCamControl (full-resolution, booth fires the shutter)']);
    c.appendChild(group('Source', [select('camSource', 'Camera source', sources, null, { rerender: true, after: () => PB.camera.stop() })]));

    if (S.camSource === 'webcam') {
      const devSel = el('select', { 'aria-label': 'Camera' }); devSel.appendChild(el('option', { value: S.camDevice }, 'Loading cameras…'));
      deviceOptions(false).then(opts => { devSel.innerHTML = ''; opts.forEach(([v, l]) => devSel.appendChild(el('option', { value: v, selected: v === S.camDevice }, l))); });
      devSel.addEventListener('change', () => { set('camDevice', devSel.value); PB.camera.stop(); });
      const preview = el('video', { playsinline: true, muted: true, autoplay: true, style: { width: '100%', maxWidth: '520px', borderRadius: '10px', background: '#000', display: 'none' } });
      let testStream = null;
      const testBtn = btn('Test camera', async () => {
        if (testStream) { testStream.getTracks().forEach(t => t.stop()); testStream = null; preview.style.display = 'none'; testBtn.textContent = 'Test camera'; return; }
        try {
          const [w, h] = String(S.camRes).split('x').map(Number);
          const v = { width: { ideal: w }, height: { ideal: h } }; if (S.camDevice && S.camDevice !== 'env') v.deviceId = { exact: S.camDevice }; else v.facingMode = S.camDevice === 'env' ? 'environment' : 'user';
          testStream = await navigator.mediaDevices.getUserMedia({ video: v }); preview.srcObject = testStream; preview.style.display = 'block'; testBtn.textContent = 'Stop test';
          preview.onloadedmetadata = () => PB.toast(`Camera running at ${preview.videoWidth}×${preview.videoHeight}`);
          if (S.mirrorPreview) preview.style.transform = 'scaleX(-1)';
        } catch (e) { PB.toast('Camera test failed: ' + (e.message || e.name), true); }
      });
      c.appendChild(group('Camera', [
        custom('Camera', 'DSLRs show up here once their webcam utility (Canon, Nikon, Sony, Fujifilm, Panasonic…) is running or a capture card is plugged in.', devSel),
        select('camRes', 'Resolution', [['1280x720', 'HD 1280×720'], ['1920x1080', 'Full HD 1920×1080'], ['3840x2160', '4K 3840×2160 (if supported)']], 'Higher is sharper for prints; the camera may pick the closest it supports.', { after: () => PB.camera.stop() }),
        toggle('mirrorPreview', 'Mirror the live preview', 'Feels natural, like a mirror.'),
        toggle('mirrorPhoto', 'Mirror the saved photo', 'Usually off so writing reads correctly.'),
        select('camRotate', 'Rotate camera', [[0, 'No rotation'], [90, '90° (camera on its side)'], [180, '180° (upside down)'], [270, '270°']], 'For cameras mounted in portrait.'),
        el('div', { class: 'field stack' }, [testBtn, preview]),
      ]));
      c.appendChild(note('<b>DSLR as a webcam:</b> install your camera maker’s free webcam utility (or use an HDMI capture card with clean HDMI output), connect by USB, then pick the camera above. Use mains power (dummy battery) for long events and turn off auto power-off. For full-resolution DSLR stills, use the <b>tethering</b> or <b>digiCamControl</b> source instead.'));
    }

    if (S.camSource === 'hotfolder') {
      const folderLabel = el('span', { style: { fontWeight: '700' } }, PB.isDesktop ? (S.hotFolder || 'Not chosen') : (PB.camera.dirHandle ? PB.camera.dirHandle.name : 'Not chosen'));
      const choose = btn('Choose folder', async () => {
        try {
          if (PB.isDesktop) { const r = await PB.native.pickFolder(); if (r) { set('hotFolder', r); folderLabel.textContent = r; } }
          else { if (!PB.camera.hotFolderSupported()) { PB.toast('Folder watching needs Chrome or Edge on a computer, or the desktop app.', true); return; } folderLabel.textContent = await PB.camera.pickHotFolder(); }
        } catch (e) { if (e.name !== 'AbortError') PB.toast(e.message, true); }
      });
      const devSel = el('select', { 'aria-label': 'Preview camera' }); devSel.appendChild(el('option', { value: '' }, 'Loading…'));
      deviceOptions(true).then(opts => { devSel.innerHTML = ''; opts.forEach(([v, l]) => devSel.appendChild(el('option', { value: v, selected: v === S.hotPreviewDevice }, l))); });
      devSel.addEventListener('change', () => set('hotPreviewDevice', devSel.value));
      c.appendChild(group('Tethered DSLR', [
        custom('Camera folder', 'The folder where your tethering app (EOS Utility, Nikon Camera Control, digiCamControl, Lightroom tether…) saves each new photo.', el('div', { class: 'row' }, [folderLabel, choose])),
        custom('Live preview from', 'Optional. A webcam or the camera’s HDMI feed through a capture card, so guests can frame themselves.', devSel),
        number('hotTimeout', 'Wait for each photo (seconds)', 'How long to wait for the camera to deliver the file.', 5, 120),
        select('camRotate', 'Rotate photos', [[0, 'No rotation'], [90, '90°'], [180, '180°'], [270, '270°']], null),
      ]));
      c.appendChild(note('<b>How it works:</b> the booth counts down, then waits for a new photo file to land in the folder. Fire the camera with its own remote, a wireless shutter release, or your tethering app’s trigger at the end of the countdown. Set the camera to save <b>JPEG</b> (not RAW only).'));
    }

    if (S.camSource === 'digicam') {
      const status = el('span', { style: { fontWeight: '700' } }, '');
      c.appendChild(group('digiCamControl', [
        text('dccHost', 'Web server address', 'Usually 127.0.0.1:5513 when digiCamControl runs on this PC.'),
        toggle('dccPreview', 'Show the camera’s live view', 'Guests see themselves on screen. Needed for GIFs.'),
        number('hotTimeout', 'Wait for each photo (seconds)', null, 5, 120),
        select('camRotate', 'Rotate photos', [[0, 'No rotation'], [90, '90°'], [180, '180°'], [270, '270°']], null),
        custom('Connection', null, el('div', { class: 'row' }, [status, btn('Test connection', async () => {
          status.textContent = 'Checking…';
          const r = await PB.native.dccStatus({ host: PB.settings.dccHost }).catch(e => ({ ok: false, error: e.message }));
          status.textContent = r.ok ? 'Connected' + (r.camera ? ` (${r.camera})` : '') : 'Not connected: ' + (r.error || 'no reply');
          status.style.color = r.ok ? 'var(--teal)' : 'var(--danger)';
        }), btn('Test photo', async () => {
          try { PB.toast('Taking a test photo…'); const r = await PB.native.dccCapture({ host: PB.settings.dccHost, timeoutMs: 30000 }); if (!r.data) throw new Error(r.error || 'No photo'); const bmp = await PB.camera.decode(r.data); PB.toast(`Got ${bmp.width}×${bmp.height} photo from the camera`); }
          catch (e) { PB.toast(e.message, true); }
        })])),
      ]));
      c.appendChild(note('<b>Setup:</b> install the free <b>digiCamControl</b> app, connect the camera by USB, then in digiCamControl open <i>File → Settings → Webserver</i>, turn on <i>Use web server</i> and <i>Allow interaction via webserver</i>, and restart it. Leave digiCamControl running while the booth is open. The booth fires the shutter at the end of each countdown and pulls the full-resolution photo.'));
    }

    // Green screen
    const gs = [toggle('greenScreen', 'Green screen', 'Replace a green (or blue) backdrop behind guests with a fun scene.', { rerender: true, after: () => PB.camera.stop() })];
    if (S.greenScreen) {
      gs.push(select('gsColor', 'Backdrop cloth colour', [['green', 'Green'], ['blue', 'Blue']], null, { after: () => PB.camera.stop() }));
      const range = el('input', { type: 'range', min: 0, max: 100, value: S.gsStrength, 'aria-label': 'Strength', style: { width: '200px' } });
      range.addEventListener('input', () => set('gsStrength', Number(range.value)));
      gs.push(custom('Keying strength', 'Raise if green shows around people; lower if people turn see-through.', range));
      gs.push(toggle('gsGuestPick', 'Guests choose the scene', 'Shows scene choices on the start screen.'));
      const list = el('div', { class: 'bg-list' });
      PB.app.backdropList().then(items => {
        items.forEach(b => {
          const tile = el('div', { class: 'bg', title: b.name, style: { backgroundImage: `url("${b.thumb}")`, outline: b.id === PB.settings.gsBackdrop ? '3px solid var(--ink)' : '', outlineOffset: '2px', cursor: 'pointer' }, onclick: () => { set('gsBackdrop', b.id); rerender(); } });
          if (!b.id.startsWith('bd-')) tile.appendChild(el('button', { 'aria-label': 'Remove scene', onclick: async e => { e.stopPropagation(); await PB.db.del('assets', b.id); if (PB.settings.gsBackdrop === b.id) set('gsBackdrop', 'bd-confetti'); rerender(); } }, '×'));
          list.appendChild(tile);
        });
      });
      gs.push(el('div', { class: 'field stack' }, [lbl('Scenes', 'Tap one to make it the default. Add your own pictures too.'), list, el('div', { class: 'row' }, [btn('Add a scene picture', async () => {
        const files = await PB.pickFile('image/*', { multiple: true }); if (!files || !files.length) return;
        for (const f of files) {
          const img = await PB.loadImage(await PB.blobToDataURL(f)); const s = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
          const cv = PB.makeCanvas(img.naturalWidth * s, img.naturalHeight * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          await PB.db.put('assets', { id: 'bg-' + PB.uid(), kind: 'backdrop', name: f.name.replace(/\.[^.]+$/, ''), data: cv.toDataURL('image/jpeg', 0.88) });
        }
        rerender();
      })])]));
    }
    c.appendChild(group('Green screen', gs));
  }

  /* ---------- Layouts ---------- */
  function secLayouts(c) {
    head(c, 'Card layouts', 'Choose which cards guests can pick, edit them, or bring in your own designs.');
    c.appendChild(el('div', { class: 'row', style: { marginBottom: '14px' } }, [
      btn('Import layout', importLayout, 'primary'),
      btn('New blank layout', () => {
        let m; const sel = el('select', { style: { width: '100%', fontSize: '18px', padding: '10px', borderRadius: '10px' } });
        PB.layouts.PRESETS.forEach(p => sel.appendChild(el('option', { value: p.id }, `${p.label} (${p.w}×${p.h})`)));
        m = PB.modal([el('h3', { text: 'New layout' }), el('p', { text: 'Pick a card size. You can change it later.' }), sel,
          el('div', { class: 'modal-actions' }, [el('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), el('button', { class: 'btn primary', onclick: () => { m.close(); editLayout(PB.layouts.blank(sel.value), true); } }, 'Create')])]);
      }),
    ]));
    c.appendChild(note('<b>Bring your own design:</b> make a card in Canva, Photoshop or Photopea at 300 dpi (4×6 in = 1200×1800 px, 2×6 strip = 600×1800 px). Erase the photo areas so they are <b>see-through</b> and export as <b>PNG</b>. Import it here and the booth finds the photo windows automatically. A JPG becomes a background that you place photos on. Layout files (.json) from other booths import too.'));
    const grid = el('div', { class: 'layout-list' });
    PB.layouts.all().forEach(L => {
      const enabled = PB.settings.enabledLayouts.includes(L.id);
      const img = el('img', { alt: '' }); PB.layouts.thumb(L, 300).then(u => img.src = u).catch(() => {});
      const chk = el('input', { type: 'checkbox', checked: enabled, 'aria-label': 'Show to guests' });
      chk.addEventListener('change', () => {
        let list = PB.settings.enabledLayouts.filter(x => x !== L.id); if (chk.checked) list.push(L.id);
        if (!list.length) { chk.checked = true; PB.toast('Keep at least one layout turned on.', true); return; }
        set('enabledLayouts', list); if (!list.includes(PB.settings.defaultLayout)) set('defaultLayout', list[0]); rerender();
      });
      const isDefault = PB.settings.defaultLayout === L.id;
      grid.appendChild(el('div', { class: 'layout-card' }, [
        el('div', { class: 'thumb' }, img),
        el('div', { class: 'name' }, [L.name, isDefault ? el('span', { class: 'tag', text: 'Default' }) : null]),
        el('div', { class: 'meta', text: `${L.slots.length} photo${L.slots.length > 1 ? 's' : ''}, ${L.width}×${L.height}${L.builtin ? ', built in' : ''}` }),
        el('label', { class: 'row', style: { fontWeight: '700' } }, [el('span', { class: 'switch' }, [chk, el('span')]), 'Show to guests']),
        el('div', { class: 'row' }, [
          !isDefault ? btn('Make default', () => { set('defaultLayout', L.id); if (!PB.settings.enabledLayouts.includes(L.id)) set('enabledLayouts', PB.settings.enabledLayouts.concat([L.id])); rerender(); }) : null,
          btn(L.builtin ? 'Copy & edit' : 'Edit', () => editLayout(L.builtin ? PB.layouts.duplicate(L) : L, L.builtin)),
        ]),
        el('div', { class: 'row' }, [
          btn('Export', () => PB.download(new Blob([PB.layouts.exportJSON(L)], { type: 'application/json' }), PB.slug(L.name) + '.pblayout.json')),
          !L.builtin ? btn('Delete', async () => { if (await PB.confirm('Delete this layout?', L.name, 'Delete', true)) { await PB.layouts.remove(L.id); rerender(); } }, 'danger') : null,
        ]),
      ]));
    });
    c.appendChild(grid);
  }
  async function importLayout() {
    const files = await PB.pickFile('.json,application/json,image/png,image/jpeg,image/webp', { multiple: true });
    if (!files || !files.length) return;
    for (const f of files) {
      try {
        const res = await PB.layouts.importFile(f);
        if (res.needsEditing && files.length === 1) { PB.toast(res.note, false, 5000); editLayout(res.layouts[0], true); return; }
        for (const L of res.layouts) { const saved = await PB.layouts.save(L); if (!PB.settings.enabledLayouts.includes(saved.id)) PB.settings.enabledLayouts.push(saved.id); }
        PB.saveSettings(); PB.toast(res.note, false, 4500);
      } catch (e) { PB.toast(`${f.name}: ${e.message}`, true, 6000); }
    }
    rerender();
  }
  function editLayout(L, isNew) {
    PB.editor.open(L, () => { PB.app.show('settings'); ui.open('layouts'); }, isNew);
  }
  ui.importLayout = importLayout;

  /* ---------- Printing ---------- */
  function secPrint(c) {
    const S = PB.settings;
    head(c, 'Printing', 'Prints are sized for photo paper. Strips print two side by side on a 4×6 sheet, ready to cut.');
    const items = [
      toggle('printEnabled', 'Print button', 'Let guests print their cards.', { rerender: true }),
      select('paper', 'Paper size', Object.entries(PB.output.PAPERS).map(([k, v]) => [k, v.label])),
      select('printFit', 'Fit', [['contain', 'Whole card (may leave thin white edges)'], ['cover', 'Fill the paper (trims edges slightly)']]),
      number('maxCopies', 'Most copies per guest', '1 skips the copies question.', 1, 20),
      toggle('autoPrint', 'Print automatically', 'Prints when the guest taps Done (if they did not print already).', { rerender: true }),
      S.autoPrint ? number('autoPrintCopies', 'Automatic copies', null, 1, 10) : null,
    ];
    c.appendChild(group('Prints', items));
    if (PB.isDesktop) {
      const sel = el('select', { 'aria-label': 'Printer' }); sel.appendChild(el('option', { value: '' }, 'Ask each time (show print dialog)'));
      PB.native.listPrinters().then(list => (list || []).forEach(p => sel.appendChild(el('option', { value: p.name, selected: p.name === S.printer }, p.displayName || p.name + (p.isDefault ? ' (default)' : ''))))).catch(() => {});
      sel.addEventListener('change', () => set('printer', sel.value));
      c.appendChild(group('Printer', [
        custom('Printer', 'Pick your photo printer (DNP, Canon SELPHY, Epson, HiTi, Mitsubishi…) to print without a dialog.', sel),
        toggle('silentPrint', 'Print without the dialog', 'Sends straight to the chosen printer.'),
      ]));
      c.appendChild(note('Set the printer’s own paper size and borderless option in Windows (Printers & scanners → your printer → Printing preferences) to match the paper size above.'));
    } else {
      c.appendChild(note('In the browser, the print dialog opens each time. Choose your photo printer, the matching paper size, and <b>Margins: None</b> (or borderless) once and most browsers remember it. For one-tap printing with no dialog, use the Windows desktop app.'));
    }
    c.appendChild(el('div', { class: 'row' }, [btn('Print a test card', async () => {
      const L = PB.layouts.get(PB.settings.defaultLayout) || PB.layouts.enabled()[0];
      const cv = await PB.compose.render(L, PB.compose.placeholders(L.slots.length), { scale: 1 });
      try { await PB.output.print(cv, 1); } catch (e) { PB.toast(e.message, true); }
    })]));
  }

  /* ---------- Email ---------- */
  function relayScript() {
    return `// PartyBooth email relay — paste into script.google.com, then Deploy → New deployment → Web app
// Execute as: Me.  Who has access: Anyone.  Copy the Web app URL into PartyBooth.
var SECRET = '${PB.settings.relaySecret}';

function doPost(e) {
  var p = JSON.parse(e.postData.contents);
  if (p.secret !== SECRET) return ContentService.createTextOutput('forbidden');
  var blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mimeType, p.filename);
  MailApp.sendEmail({
    to: p.to,
    subject: p.subject,
    body: p.body,
    name: p.fromName || 'PartyBooth',
    attachments: [blob]
  });
  return ContentService.createTextOutput('ok');
}`;
  }
  function secEmail(c) {
    const S = PB.settings;
    head(c, 'Email & sharing', 'Guests type their address and get their photo by email.');
    c.appendChild(group('Buttons', [
      toggle('emailEnabled', 'Email button', null),
      toggle('shareEnabled', PB.isDesktop ? 'Save button' : 'Share / save button', PB.isDesktop ? 'Save the photo to a file.' : 'On phones and tablets this opens the share sheet (Messages, AirDrop, WhatsApp, Mail…).'),
      select('osk', 'On-screen keyboard for email', [['auto', 'Automatic (on in the desktop app)'], ['on', 'Always'], ['off', 'Never (use the device keyboard)']]),
    ]));
    if (PB.isDesktop && PB.native.shareStart) {
      const status = el('span', { style: { fontWeight: '700' }, text: 'Checking…' });
      const qrBox = el('div', { class: 'row', style: { alignItems: 'center', gap: '16px' } });
      const hostSel = el('select', { 'aria-label': 'Network address' });
      const refresh = async () => {
        const st = await PB.output.startPhoneServer();
        qrBox.innerHTML = '';
        if (!S.qrEnabled) { status.textContent = 'Off'; status.style.color = ''; return; }
        if (!st.running) { status.textContent = 'Not running: ' + st.error; status.style.color = 'var(--danger)'; return; }
        status.textContent = st.url; status.style.color = 'var(--teal)';
        const addrs = st.addresses || [];
        hostSel.innerHTML = '';
        hostSel.appendChild(el('option', { value: '', selected: !S.qrHost }, `Automatic (${addrs[0] ? addrs[0].ip : 'none found'})`));
        addrs.forEach(a => hostSel.appendChild(el('option', { value: a.ip, selected: S.qrHost === a.ip }, `${a.ip} — ${a.name}`)));
        if (S.qrHost && !addrs.some(a => a.ip === S.qrHost)) hostSel.appendChild(el('option', { value: S.qrHost, selected: true }, `${S.qrHost} (not connected now)`));
        const qc = PB.qr.canvas(st.url + '/', 300); qc.className = 'qr-inline';
        qrBox.append(qc, el('small', { style: { maxWidth: '280px', color: 'var(--muted)' }, text: 'Scan this with your phone to check it connects. You should see “PartyBooth is connected”. If not, choose another network address.' }));
      };
      hostSel.addEventListener('change', () => { set('qrHost', hostSel.value); refresh(); });
      c.appendChild(group('Phone download (QR code)', [
        toggle('qrEnabled', 'Scan-to-download button', 'Guests scan a QR code and save the photo to their phone. Works over the party Wi-Fi with no internet.', { after: refresh }),
        custom('Address guests open', null, status),
        custom('Network address', 'Pick the Wi-Fi the guests use if the booth PC has more than one.', hostSel),
        number('qrPort', 'Port', 'Change only if another program already uses it.', 1024, 65535, 1, { after: refresh }),
        text('qrWifiName', 'Wi-Fi name to show guests', 'Optional. Shown in the popup so guests join the right network.'),
        text('qrWifiPass', 'Wi-Fi password', 'Optional. Adds a “join Wi-Fi” QR code next to the photo code.', { type: 'password' }),
        el('div', { class: 'field stack' }, [qrBox]),
      ]));
      c.appendChild(note('The first time this runs, Windows asks whether PartyBooth may use the network. Tick <b>Private networks</b> and choose <b>Allow</b>. Phones must be on the same Wi-Fi as the booth. Guest networks that keep devices apart will not work; use the main Wi-Fi or a phone hotspot.'));
      refresh();
    }
    c.appendChild(group('Email message', [
      text('emailSubject', 'Subject', 'Fill-ins: {event} {date} {hashtag}', { stack: true }),
      textarea('emailBody', 'Message', 'The photo is attached.'),
      text('fromName', 'Sender name', 'Shown as who the email is from.'),
    ]));
    const methods = [['auto', 'Automatic'], ['relay', 'Google email relay (works on any device)'], ['queue', 'Collect addresses, send after the party']];
    if (PB.isDesktop) methods.splice(1, 0, ['smtp', 'My email account (SMTP)']);
    c.appendChild(group('How emails are sent', [select('emailMethod', 'Sending method', methods, `Right now: ${({ smtp: 'sending through your email account', relay: 'sending through the Google relay', queue: 'collecting addresses to send later' })[PB.output.emailMethod()]}.`, { rerender: true })]));

    if (PB.isDesktop && (S.emailMethod === 'smtp' || S.emailMethod === 'auto')) {
      const testOut = el('span', { style: { fontWeight: '700' } });
      c.appendChild(group('Email account (SMTP)', [
        custom('Quick setup', 'Fills in the server details.', el('div', { class: 'row' }, [
          btn('Gmail', () => { Object.assign(PB.settings, { smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true }); PB.saveSettings(); rerender(); }),
          btn('Yahoo', () => { Object.assign(PB.settings, { smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpSecure: true }); PB.saveSettings(); rerender(); }),
          btn('iCloud', () => { Object.assign(PB.settings, { smtpHost: 'smtp.mail.me.com', smtpPort: 587, smtpSecure: false }); PB.saveSettings(); rerender(); }),
        ])),
        text('smtpHost', 'Server', null, { placeholder: 'smtp.gmail.com' }),
        number('smtpPort', 'Port', '465 for SSL, 587 for STARTTLS.', 1, 65535),
        toggle('smtpSecure', 'SSL from the start', 'On for port 465, off for 587.'),
        text('smtpUser', 'Username', 'Usually your full email address.', { type: 'email' }),
        text('smtpPass', 'Password', 'For Gmail, Yahoo and iCloud use an app password, not your normal password.', { type: 'password' }),
        text('smtpFrom', 'From address', 'Leave empty to use the username.', { type: 'email' }),
        custom('Check it works', null, el('div', { class: 'row' }, [testOut, btn('Send me a test', async () => {
          const to = S.smtpFrom || S.smtpUser; if (!to) { PB.toast('Fill in the username first.', true); return; }
          testOut.textContent = 'Sending…';
          const r = await PB.native.sendEmail({ smtp: { host: S.smtpHost, port: Number(S.smtpPort), secure: !!S.smtpSecure, user: S.smtpUser, pass: S.smtpPass }, from: to, fromName: S.fromName, to, subject: 'PartyBooth test', text: 'Your booth can send email.', attachments: [] }).catch(e => ({ ok: false, error: e.message }));
          testOut.textContent = r.ok ? 'Sent! Check your inbox.' : 'Failed: ' + r.error; testOut.style.color = r.ok ? 'var(--teal)' : 'var(--danger)';
        })])),
      ]));
    }
    if (S.emailMethod === 'relay' || S.emailMethod === 'auto') {
      const pre = el('pre', { class: 'code', text: relayScript() });
      c.appendChild(group('Google email relay', [
        text('relayUrl', 'Relay web app URL', 'Paste the Web app URL from Google Apps Script.', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', stack: true }),
        text('relaySecret', 'Relay password', 'Must match SECRET in the script below.', { after: () => { pre.textContent = relayScript(); } }),
        el('div', { class: 'field stack' }, [lbl('Setup (5 minutes, free)', '1. Open script.google.com and create a new project. 2. Replace the code with the script below. 3. Deploy → New deployment → Web app, execute as Me, access Anyone. 4. Approve the permissions, then paste the URL above. Emails come from your Google account (about 100 per day on free accounts).'), pre,
          el('div', { class: 'row' }, [btn('Copy script', async () => { try { await navigator.clipboard.writeText(relayScript()); PB.toast('Script copied'); } catch (e) { PB.toast('Select the script and copy it manually.', true); } })])]),
      ]));
    }
    const qInfo = el('b', { text: '…' });
    PB.output.queued().then(q => { qInfo.textContent = q.length ? `${q.length} email${q.length > 1 ? 's' : ''} waiting` : 'Nothing waiting'; });
    c.appendChild(group('Waiting emails', [
      custom('Queue', 'Addresses collected while offline or before email was set up.', qInfo),
      el('div', { class: 'field' }, [el('div', { class: 'row' }, [
        btn('Send waiting emails now', async () => {
          try { PB.toast('Sending…'); const r = await PB.output.sendQueued((n, t) => { qInfo.textContent = `Sending ${n} of ${t}…`; }); PB.toast(`Sent ${r.sent}${r.failed ? `, ${r.failed} still waiting` : ''}`); rerender(); }
          catch (e) { PB.toast(e.message, true); }
        }, 'primary'),
        btn('Download email list', async () => { const z = await PB.output.exportEmailList(); PB.download(z, `${PB.slug(PB.settings.eventName)}-email-list.zip`); }),
      ])]),
    ]));
  }

  /* ---------- Kiosk ---------- */
  function secKiosk(c) {
    head(c, 'Kiosk & security', 'Keep guests out of settings and keep the booth running all night.');
    c.appendChild(group('Host PIN', [
      text('pin', 'Host PIN', 'Needed to open settings, delete photos and download everything. Leave empty for no PIN.', { type: 'password', inputmode: 'numeric', placeholder: 'e.g. 2468', after: v => { if (v && !/^\d{0,8}$/.test(v)) PB.toast('Use digits only (up to 8).', true); } }),
    ]));
    const items = [
      toggle('keepAwake', 'Keep the screen awake', 'Stops the screen from dimming or locking while the booth is open (where supported).'),
      toggle('keyTrigger', 'Keyboard and button trigger', 'Space, Enter, Page Down or B starts a session, so a USB arcade button, foot pedal or presentation clicker works as the big button.'),
    ];
    if (PB.isDesktop) {
      items.push(toggle('kioskMode', 'Kiosk mode', 'Full screen with no way out except Settings (Ctrl+Shift+Q also quits).', { after: v => PB.native.setKiosk(v) }));
      const fl = el('span', { style: { fontWeight: '700' } }, PB.settings.saveFolder || 'Pictures\\PartyBooth');
      items.push(toggle('saveToFolder', 'Save every photo to a folder', 'A copy of each card and GIF on this PC.'));
      items.push(custom('Folder', null, el('div', { class: 'row' }, [fl, btn('Change', async () => { const r = await PB.native.pickFolder(); if (r) { set('saveFolder', r); fl.textContent = r; } }), btn('Open', () => PB.native.openFolder({ folder: PB.settings.saveFolder, event: PB.slug(PB.settings.eventName) }))])));
    }
    c.appendChild(group('Running the booth', items));
    if (!PB.isDesktop) c.appendChild(note('<b>Tablets:</b> add the booth to the home screen for full screen. On iPad, turn on <i>Guided Access</i> (Settings → Accessibility) to lock the booth to this app; on Android use <i>App pinning</i>.'));
    if (PB.isDesktop) c.appendChild(el('div', { class: 'row' }, [btn('Quit PartyBooth', () => PB.native.quit(), 'danger')]));
  }

  /* ---------- Data ---------- */
  function secData(c) {
    head(c, 'Photos & backup', 'Photos are stored on this device only.');
    const info = el('b', { text: '…' });
    (async () => {
      const n = await PB.db.count('photos'); let extra = '';
      try { const e = await navigator.storage.estimate(); extra = `, ${(e.usage / 1048576).toFixed(0)} MB used`; } catch (er) { /* ignore */ }
      info.textContent = `${n} photo${n === 1 ? '' : 's'}${extra}`;
    })();
    c.appendChild(group('Photos', [
      custom('On this device', null, info),
      el('div', { class: 'field' }, [el('div', { class: 'row' }, [
        btn('Download all photos (ZIP)', async () => { try { PB.toast('Packing photos…'); PB.download(await PB.output.exportAll(), `${PB.slug(PB.settings.eventName)}-photos-${PB.fileStamp()}.zip`); } catch (e) { PB.toast(e.message, true); } }, 'primary'),
        btn('Delete all photos', async () => {
          if (!(await PB.confirm('Delete every photo?', 'This clears the gallery and waiting emails on this device. Download them first if you need them.', 'Delete all', true))) return;
          await PB.db.clear('photos'); PB.toast('Gallery cleared'); rerender();
        }, 'danger'),
      ])]),
    ]));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    c.appendChild(group('Setup backup', [
      el('div', { class: 'field' }, [lbl('Copy this setup to another device', 'Saves settings and your own layouts in one file. Passwords are not included.'), el('div', { class: 'row' }, [
        btn('Download setup', () => {
          const s = Object.assign({}, PB.settings); delete s.smtpPass;
          PB.download(new Blob([JSON.stringify({ pbBackup: 1, settings: s, layouts: PB.layouts.custom() }, null, 1)], { type: 'application/json' }), `partybooth-setup-${PB.slug(PB.settings.eventName)}.json`);
        }),
        btn('Load setup', async () => {
          const f = await PB.pickFile('.json,application/json'); if (!f) return;
          try {
            const d = JSON.parse(await PB.fileToText(f)); if (!d.pbBackup) throw new Error('That is not a PartyBooth setup file.');
            const keepPass = PB.settings.smtpPass;
            PB.settings = Object.assign(JSON.parse(JSON.stringify(PB.DEFAULTS)), d.settings || {}, { smtpPass: keepPass });
            for (const L of d.layouts || []) await PB.layouts.save(L);
            PB.saveSettings(); await PB.layouts.load(); PB.toast('Setup loaded'); rerender();
          } catch (e) { PB.toast(e.message, true); }
        }),
      ])]),
      el('div', { class: 'field' }, [lbl('Reset settings', 'Back to the original settings. Photos and layouts stay.'), btn('Reset', async () => {
        if (!(await PB.confirm('Reset all settings?', 'Photos and your layouts are kept.', 'Reset', true))) return;
        PB.settings = Object.assign(JSON.parse(JSON.stringify(PB.DEFAULTS)), { relaySecret: PB.settings.relaySecret }); PB.saveSettings(); rerender();
      }, 'danger')]),
    ]));
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#btnSettingsDone').addEventListener('click', () => { PB.camera.stop(); PB.app.refresh(); PB.app.show('start'); });
  });
})(window.PB);
