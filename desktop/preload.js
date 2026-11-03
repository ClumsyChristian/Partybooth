/* PartyBooth desktop — safe bridge between the booth page and Windows features */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = channel => arg => ipcRenderer.invoke(channel, arg);

contextBridge.exposeInMainWorld('boothNative', {
  platform: process.platform,
  // printing
  listPrinters: call('printers'),
  print: call('print'),
  // email
  sendEmail: call('email'),
  // files
  pickFolder: call('pickFolder'),
  saveAs: call('saveAs'),
  saveToFolder: call('saveToFolder'),
  openFolder: call('openFolder'),
  // DSLR: hot folder
  hotfolderArm: call('hotfolderArm'),
  hotfolderWait: call('hotfolderWait'),
  // DSLR: digiCamControl
  dccStatus: call('dccStatus'),
  dccLiveView: call('dccLiveView'),
  dccFrame: call('dccFrame'),
  dccCapture: call('dccCapture'),
  // phone download (QR code on the local network)
  shareStart: call('shareStart'),
  shareStop: call('shareStop'),
  shareStatus: call('shareStatus'),
  sharePublish: call('sharePublish'),
  // window
  setKiosk: call('setKiosk'),
  setFullscreen: call('toggleFullscreen'),
  quit: call('quit'),
});
