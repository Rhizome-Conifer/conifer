from PyInstaller.utils.hooks import collect_all

# explicitly add greenlet as default gevent hook may not discover it
datas, binaries, hiddenimports = collect_all('greenlet')

