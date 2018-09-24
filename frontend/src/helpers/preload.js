const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', (evt) => {
  const state = {
    wb_type: 'load',
    url: window.wbinfo.url,
    ts: window.wbinfo.timestamp
  };

  ipcRenderer.sendToHost('load', state);
});

document.addEventListener('hashchange', (evt) => {
  const state = {
    wb_type: 'hashchange',
    hash: window.location.hash
  };

  ipcRenderer.sendToHost('hashchange', state);
});

document.addEventListener('drop', (evt) => {
  evt.preventDefault();

  const filename = evt.dataTransfer.files[0].path;
  const state = {
    wb_type: 'open',
    filename
  };

  ipcRenderer.sendToHost('open', state);
});

document.addEventListener('dragover', (evt) => {
  evt.preventDefault();
  evt.stopPropagation();
});
