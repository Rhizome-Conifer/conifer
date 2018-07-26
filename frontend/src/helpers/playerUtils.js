import config from 'config';

const { ipcRenderer, remote } = window.require('electron');


/*
button #open
display a file selector and call ipc "open-warc" on main
*/
export function openFile(history) {
  remote.dialog.showOpenDialog(
    {
      properties: ['openFile'],
      filters: [{ name: 'Warc', extensions: ['gz', 'warc', 'arc', 'warcgz', 'har'] }]
    },
    (filename) => {
      if (filename && filename.toString().match(/\.w?arc(\.gz)?|\.har$/)) {
        if (history && history.push) {
          history.push('/');
        }

        ipcRenderer.send('open-warc', filename.toString());
      } else if (filename) {
        window.alert('Sorry, only WARC or ARC files (.warc, .warc.gz, .arc, .arc.gz) or HAR (.har) can be opened');
      }
    }
  );
}
