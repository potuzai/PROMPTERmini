'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('native', {
  dataDir: ipcRenderer.sendSync('dataDir'),
  readerMode: true,
  all: store => ipcRenderer.invoke('all', store),
  put: (store, obj) => ipcRenderer.invoke('put', store, obj),
  del: (store, id) => ipcRenderer.invoke('del', store, id),
  loadSettings: () => ipcRenderer.sendSync('loadSettings'),
  saveSettings: txt => ipcRenderer.sendSync('saveSettings', txt),
  openDataDir: () => ipcRenderer.invoke('openDataDir'),
  setAutoStart: on => ipcRenderer.invoke('setAutoStart', on),
  getAutoStart: () => ipcRenderer.sendSync('getAutoStart'),
  setFullscreen: on => ipcRenderer.invoke('setFullscreen', on),
  isFullscreen: () => ipcRenderer.sendSync('isFullscreen'),
  quit: () => ipcRenderer.invoke('quit'),
});
