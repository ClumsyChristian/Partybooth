// Copies the booth web app (../app) into this folder so Electron can load it.
'use strict';
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'app');
const dst = path.join(__dirname, '..', 'app');
if (!fs.existsSync(path.join(src, 'index.html'))) { console.error('Cannot find the booth app at ' + src); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Copied booth app into desktop/app');
