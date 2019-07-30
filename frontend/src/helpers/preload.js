const { ipcRenderer } = require('electron');

const wr_msg_handler = '___$wr_msg_handler___$$';

class IPCHandler {
    constructor() {
      this.on_message = null;

      ipcRenderer.on('wr-message', (event) => {
        if (this.on_message) {
          this.on_message(event.data);
        }
      }
    }

    send(msg) {
      ipcRenderer.sendToHost('wr-message', msg);
    }
}

window[ws_msg_handler] = new IPCHandler();


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
