/* PartyBooth — camera sources: webcam / DSLR-as-webcam / HDMI capture, DSLR hot folder, digiCamControl (desktop) */
'use strict';
(function (PB) {
  const MAX_SIDE = 2600; // photos are scaled to at most this many pixels on the long side

  const cam = {
    stream: null, running: false, loopId: 0, kind: 'none',
    video: null, canvas: null, img: null, noPrev: null,
    backdrop: null, previewAspect: 4 / 3,
    dirHandle: null, hotSnapshot: null,
  };
  PB.camera = cam;

  cam.bind = function () {
    cam.video = document.getElementById('video');
    cam.canvas = document.getElementById('liveCanvas');
    cam.img = document.getElementById('liveImg');
    cam.noPrev = document.getElementById('noPreview');
  };

  cam.supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  cam.listDevices = async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    let list = await navigator.mediaDevices.enumerateDevices();
    if (list.filter(d => d.kind === 'videoinput').every(d => !d.label) && !cam.stream) {
      try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); list = await navigator.mediaDevices.enumerateDevices(); } catch (e) { /* permission denied */ }
    }
    return list.filter(d => d.kind === 'videoinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  };

  function constraintsFor(deviceSetting) {
    const [w, h] = String(PB.settings.camRes || '1920x1080').split('x').map(Number);
    const v = { width: { ideal: w }, height: { ideal: h } };
    if (deviceSetting === 'env') v.facingMode = { ideal: 'environment' };
    else if (!deviceSetting || deviceSetting === 'user') v.facingMode = { ideal: 'user' };
    else v.deviceId = { exact: deviceSetting };
    return { video: v, audio: false };
  }

  async function openStream(deviceSetting) {
    if (!cam.supported()) throw new Error(location.protocol === 'http:' ? 'The camera needs a secure (https) address. Open the booth from an https link or the desktop app.' : 'This browser cannot open a camera.');
    try { return await navigator.mediaDevices.getUserMedia(constraintsFor(deviceSetting)); }
    catch (e) {
      if (e && e.name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (e && e.name === 'NotAllowedError') throw new Error('Camera permission was blocked. Allow camera access for this page in the browser settings.');
      if (e && e.name === 'NotFoundError') throw new Error('No camera found. Plug in your camera (or start your DSLR webcam utility) and try again.');
      if (e && e.name === 'NotReadableError') throw new Error('The camera is busy in another app. Close other apps using it and try again.');
      throw e;
    }
  }

  function showLayer(which) {
    cam.video.style.display = which === 'video' ? 'block' : 'none';
    cam.canvas.style.display = which === 'canvas' ? 'block' : 'none';
    cam.noPrev.hidden = which !== 'none';
    const mirror = PB.settings.mirrorPreview && cam.kind === 'webcam';
    cam.video.classList.toggle('mirror', mirror); cam.canvas.classList.toggle('mirror', mirror);
    cam.video.style.transform = cam.canvas.style.transform = '';
    const rot = Number(PB.settings.camRotate) || 0;
    if (rot && which !== 'none') {
      const el = which === 'video' ? cam.video : cam.canvas;
      el.style.transform = `${mirror ? 'scaleX(-1) ' : ''}rotate(${rot}deg)`;
    }
  }

  /** Start the live preview for the configured source. */
  cam.start = async function () {
    const S = PB.settings;
    if (cam.running && cam.startedFor === sourceKey()) return;
    cam.stop();
    cam.startedFor = sourceKey();
    cam.backdrop = S.greenScreen ? await PB.compose.backdropSource(PB.app && PB.app.state.backdrop || S.gsBackdrop) : null;
    const src = S.camSource;
    if (src === 'digicam') {
      if (!PB.native) throw new Error('digiCamControl mode needs the Windows desktop app.');
      cam.kind = 'digicam'; cam.running = true;
      if (S.dccPreview) { try { await PB.native.dccLiveView({ host: S.dccHost, on: true }); } catch (e) { /* preview optional */ } startDccLoop(); showLayer('canvas'); }
      else showLayer('none');
      return;
    }
    if (src === 'hotfolder') {
      cam.kind = 'hotfolder'; cam.running = true;
      if (S.hotPreviewDevice) {
        try { cam.stream = await openStream(S.hotPreviewDevice); await attachVideo(); }
        catch (e) { console.warn(e); showLayer('none'); }
      } else showLayer('none');
      return;
    }
    cam.kind = 'webcam';
    cam.stream = await openStream(S.camDevice);
    cam.running = true;
    await attachVideo();
  };
  function sourceKey() { const S = PB.settings; return [S.camSource, S.camDevice, S.camRes, S.hotPreviewDevice, S.greenScreen, S.dccHost, S.dccPreview, PB.app && PB.app.state.backdrop].join('|'); }

  async function attachVideo() {
    const v = cam.video; v.srcObject = cam.stream;
    try { await v.play(); } catch (e) { /* autoplay muted is allowed */ }
    await new Promise(r => { if (v.videoWidth) r(); else { v.onloadedmetadata = () => r(); setTimeout(r, 3000); } });
    cam.previewAspect = (v.videoWidth / v.videoHeight) || 4 / 3;
    if (PB.settings.greenScreen) { showLayer('canvas'); startGreenLoop(); } else showLayer('video');
  }

  function startGreenLoop() {
    const id = ++cam.loopId; const c = cam.canvas; const tmp = PB.makeCanvas(2, 2);
    const S = PB.settings;
    const step = () => {
      if (id !== cam.loopId) return;
      const v = cam.video;
      if (v.videoWidth) {
        const sc = Math.min(1, 640 / v.videoWidth); const w = Math.round(v.videoWidth * sc), h = Math.round(v.videoHeight * sc);
        if (tmp.width !== w) { tmp.width = w; tmp.height = h; }
        tmp.getContext('2d').drawImage(v, 0, 0, w, h);
        PB.compose.greenScreen(tmp, cam.backdrop, { color: S.gsColor, strength: S.gsStrength, out: c });
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function startDccLoop() {
    const id = ++cam.loopId; const c = cam.canvas; const S = PB.settings; let fails = 0;
    (async function loop() {
      while (id === cam.loopId) {
        try {
          const buf = await PB.native.dccFrame({ host: S.dccHost });
          if (buf && buf.byteLength > 100) {
            const bmp = await createImageBitmap(new Blob([buf], { type: 'image/jpeg' }));
            cam.previewAspect = bmp.width / bmp.height;
            if (S.greenScreen) PB.compose.greenScreen(bmp, cam.backdrop, { color: S.gsColor, strength: S.gsStrength, out: c });
            else { if (c.width !== bmp.width) { c.width = bmp.width; c.height = bmp.height; } c.getContext('2d').drawImage(bmp, 0, 0); }
            cam.lastFrame = c; fails = 0; showLayer('canvas');
          } else fails++;
        } catch (e) { fails++; }
        if (fails > 25) showLayer('none');
        await PB.sleep(fails ? 300 : 60);
      }
    })();
  }

  cam.stop = function () {
    cam.loopId++;
    if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; }
    if (cam.video) { cam.video.srcObject = null; }
    if (cam.kind === 'digicam' && PB.native && PB.settings.dccPreview) PB.native.dccLiveView({ host: PB.settings.dccHost, on: false }).catch(() => {});
    cam.running = false; cam.startedFor = null;
  };

  cam.hasLivePreview = function () {
    if (cam.kind === 'webcam') return true;
    if (cam.kind === 'hotfolder') return !!cam.stream;
    if (cam.kind === 'digicam') return !!PB.settings.dccPreview;
    return false;
  };
  cam.isSlow = () => cam.kind === 'hotfolder' || cam.kind === 'digicam';

  /* ---------- Turning sources into a finished photo canvas ---------- */
  function finish(src, opts = {}) {
    const S = PB.settings; const sz = { w: src.videoWidth || src.width, h: src.videoHeight || src.height };
    const cap = opts.max || MAX_SIDE; const sc = Math.min(1, cap / Math.max(sz.w, sz.h));
    const w = Math.round(sz.w * sc), h = Math.round(sz.h * sc);
    const rot = ((Number(S.camRotate) || 0) % 360 + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const c = PB.makeCanvas(swap ? h : w, swap ? w : h); const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(c.width / 2, c.height / 2);
    if (rot) ctx.rotate(rot * Math.PI / 180);
    const mirror = opts.mirror !== undefined ? opts.mirror : (S.mirrorPhoto && cam.kind === 'webcam');
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    if (S.greenScreen && !opts.keyed) return PB.compose.greenScreen(c, cam.backdrop, { color: S.gsColor, strength: S.gsStrength });
    return c;
  }

  async function decode(blobOrBuf, type) {
    const blob = blobOrBuf instanceof Blob ? blobOrBuf : new Blob([blobOrBuf], { type: type || 'image/jpeg' });
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) {
      const url = URL.createObjectURL(blob);
      try { return await PB.loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
    }
  }
  cam.decode = decode;

  /** Called right before each countdown so DSLR sources know what is "new". */
  cam.arm = async function () {
    const S = PB.settings;
    if (cam.kind !== 'hotfolder') return;
    if (PB.native) {
      if (!S.hotFolder) throw new Error('Choose the camera folder in Settings → Camera first.');
      await PB.native.hotfolderArm({ folder: S.hotFolder }); return;
    }
    cam.hotSnapshot = await listDir(cam.dirHandle);
  };

  /** Take one full-quality photo. Returns a canvas. */
  cam.capture = async function () {
    const S = PB.settings;
    if (cam.kind === 'webcam') {
      const v = cam.video; if (!v.videoWidth) throw new Error('The camera is not ready yet.');
      return finish(v);
    }
    if (cam.kind === 'digicam') {
      const res = await PB.native.dccCapture({ host: S.dccHost, timeoutMs: (S.hotTimeout || 20) * 1000 });
      if (!res || !res.data) throw new Error((res && res.error) || 'No photo came back from the camera.');
      return finish(await decode(res.data), { mirror: false });
    }
    if (cam.kind === 'hotfolder') {
      const timeout = (S.hotTimeout || 20) * 1000;
      if (PB.native) {
        const res = await PB.native.hotfolderWait({ folder: S.hotFolder, timeoutMs: timeout });
        if (!res || !res.data) throw new Error((res && res.error) || 'No new photo arrived in the camera folder.');
        return finish(await decode(res.data), { mirror: false });
      }
      const file = await waitForNewFile(timeout);
      return finish(await decode(file), { mirror: false });
    }
    throw new Error('No camera is running.');
  };

  /** Quick, smaller frame from the live preview (for GIF bursts). */
  cam.grabFrame = function (max = 900) {
    if (cam.kind === 'webcam' || (cam.kind === 'hotfolder' && cam.stream)) {
      const v = cam.video; if (!v.videoWidth) return null;
      return finish(v, { max, mirror: cam.kind === 'webcam' ? PB.settings.mirrorPhoto : false });
    }
    if (cam.kind === 'digicam' && cam.lastFrame) {
      const c = PB.makeCanvas(cam.lastFrame.width, cam.lastFrame.height); c.getContext('2d').drawImage(cam.lastFrame, 0, 0);
      return finish(c, { max, mirror: false, keyed: PB.settings.greenScreen });
    }
    return null;
  };

  /* ---------- Browser hot folder (File System Access API, Chrome/Edge on Windows) ---------- */
  cam.hotFolderSupported = () => 'showDirectoryPicker' in window;
  cam.pickHotFolder = async function () {
    const h = await window.showDirectoryPicker({ id: 'pb-hotfolder', mode: 'read' });
    cam.dirHandle = h; try { await PB.db.put('kv', h, 'hotDir'); } catch (e) { /* handles may not be storable */ }
    return h.name;
  };
  cam.restoreHotFolder = async function () {
    if (PB.native) return;
    try { cam.dirHandle = (await PB.db.get('kv', 'hotDir')) || null; } catch (e) { cam.dirHandle = null; }
  };
  /** Must be called from a click (user gesture) in the browser. */
  cam.ensureHotFolderPermission = async function () {
    if (PB.native || PB.settings.camSource !== 'hotfolder') return true;
    if (!cam.dirHandle) throw new Error('Choose the camera folder in Settings → Camera first.');
    if (cam.dirHandle.queryPermission && (await cam.dirHandle.queryPermission({ mode: 'read' })) === 'granted') return true;
    if (cam.dirHandle.requestPermission && (await cam.dirHandle.requestPermission({ mode: 'read' })) === 'granted') return true;
    throw new Error('Allow the booth to read the camera folder to continue.');
  };
  const IMG_RE = /\.(jpe?g|png|webp)$/i;
  async function listDir(dir) {
    const names = new Set(); if (!dir) return names;
    for await (const [name, h] of dir.entries()) if (h.kind === 'file' && IMG_RE.test(name)) names.add(name);
    return names;
  }
  async function waitForNewFile(timeout) {
    const dir = cam.dirHandle; if (!dir) throw new Error('No camera folder chosen.');
    const before = cam.hotSnapshot || new Set(); const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'file' || !IMG_RE.test(name) || before.has(name)) continue;
        let last = -1;
        for (let i = 0; i < 40; i++) {               // wait until the file has finished writing
          const f = await h.getFile();
          if (f.size > 0 && f.size === last) { before.add(name); return f; }
          last = f.size; await PB.sleep(250);
        }
      }
      await PB.sleep(400);
    }
    throw new Error('No new photo arrived in the camera folder. Check the tethering app is saving there.');
  }
})(window.PB);
