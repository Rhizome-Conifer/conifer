import { updateUrlAndTimestamp } from 'store/modules/controls';
import { setStats } from 'store/modules/infoStats';

import config from 'config';

import { remoteBrowserMod } from 'helpers/utils';


class WebSocketHandler {
  constructor(params, currMode, dispatch, remoteBrowser = false, reqId = null, host = '') {
    const { user, coll, rec, splat, br } = params;

    this.startMsg = undefined;
    this.currMode = currMode;
    this.user = user;
    this.coll = coll;
    this.rec = rec;
    this.reqUrl = splat;
    this.useWS = false;
    this.dispatch = dispatch;
    this.lastPopUrl = undefined;
    this.params = params;
    this.host = host || window.location.host;
    this.retryHandle = null;

    this.isRemoteBrowser = remoteBrowser;
    this.br = br;
    this.reqId = reqId;
    this.wsEndpoint = '_client_ws';

    if (this.isRemoteBrowser) {
      window.addEventListener('popstate', this.syncOuterFrameState);
    }

    this.initWS();
  }

  initWS = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    let url = `${wsProtocol}${this.host ? this.host : ''}/${this.wsEndpoint}?user=${this.user}&coll=${this.coll}`;

    if (this.rec && this.rec !== '*') {
      url += `&rec=${this.rec}`;
    }

    if (this.reqId) {
      url += `&reqid=${this.reqId}`;
    }

    url += `&type=${this.currMode}&url=${encodeURIComponent(this.reqUrl)}`;

    try {
      this.ws = new WebSocket(url);
      this.ws.addEventListener('open', this.wsOpened);
      this.ws.addEventListener('message', this.wsReceived);
      this.ws.addEventListener('close', this.wsClosed);
      this.ws.addEventListener('error', this.wsClosed);
    } catch (e) {
      this.useWS = false;
    }
  }

  close = () => {
    this.ws.removeEventListener('open', this.wsOpened);
    this.ws.removeEventListener('message', this.wsReceived);
    this.ws.removeEventListener('close', this.wsClosed);
    this.ws.removeEventListener('error', this.wsClosed);

    clearTimeout(this.retryHandle);

    if (this.isRemoteBrowser) {
      window.removeEventListener('popstate', this.syncOuterFrameState);
    }

    return this.ws.close();
  }

  hasWS = () => this.useWS;

  wsOpened = () => {
    this.useWS = true;
    this.errCount = 0;
    if (this.startMsg) {
      this.sendMsg(this.startMsg);
    }
  }

  wsClosed = () => {
    this.useWS = false;
    if (this.errCount < 5) {
      this.errCount += 1;
      this.retryHandle = setTimeout(this.initWS, 2000);
    }
  }

  wsReceived = (evt) => {
    const msg = JSON.parse(evt.data);

    switch (msg.ws_type) {
      case 'status':
        if (msg.stats || msg.size || msg.pending_size) {
          this.dispatch(setStats(msg.stats, msg.size || 0, msg.pending_size || 0));
        }
        break;
      case 'remote_url': {
        if (this.isRemoteBrowser) {
          const { page } = msg;
          this.dispatch(updateUrlAndTimestamp(page.url, page.timestamp));

          //setTitle("Remote", page.url, page.title);
          this.replaceOuterUrl(page, "load");
        }
        break;
      }
      case 'patch_req':
        if (this.isRemoteBrowser) {
          // if we're replaying
          if (this.currMode.indexOf('replay') !== -1) {
            // TODO
            // EventHandlers.switchCBPatch(getUrl());
          }
        }
        break;
      case 'snapshot':
        // Snapshot.updateModal(msg);
        break;
      default:
        console.log(msg);
    }
  }

  sendMsg = (msg) => {
    if (!this.hasWS()) {
      return false;
    }

    this.ws.send(JSON.stringify(msg));
    return true;
  }

  syncOuterFrameState = (evt) => {
    if (evt && evt.state && this.hasWS()) {
      const { state } = evt;
      this.lastPopUrl = state.url;

      switch (state.change) {
        case 'load':
          this.setRemoteUrl(state.url);
          break;
        case 'patch':
          // TODO:
          // EventHandlers.switchCBReplay(getUrl());
          break;
        case 'replay-coll':
          // TODO:
          // EventHandlers.switchCBPatch(getUrl());
          break;
        default:
          break;
      }
    }
  }

  replaceOuterUrl = (msg, change) => {
    const ts = msg.timestamp;
    const mod = remoteBrowserMod(this.br, ['replay', 'replay-coll', 'patch', 'extract', 'extract_only'].includes(this.currMode) && ts ? ts : null, '/');
    const { url } = msg;
    let prefix;

    if (this.currMode.includes('replay')) {
      if (this.params.bookmarkId) {
        const { listSlug, bookmarkId } = this.params;
        prefix = `${config.appHost}/${this.user}/${this.coll}/list/${listSlug}/b${bookmarkId}/`;
      } else {
        prefix = `${config.appHost}/${this.user}/${this.coll}/`;
      }
    } else if (['patch', 'record'].includes(this.currMode)) {
      prefix = `${config.appHost}/${this.user}/${this.coll}/${this.rec}/${this.currMode}/`;
    } else if (['extract', 'extract_only'].includes(this.currMode)) {
      const { archiveId, collId } = this.params;
      prefix = `${config.appHost}/${this.user}/${this.coll}/${this.rec}/${this.currMode}:${archiveId}${collId || ''}/`;
    }

    msg.change = change;

    if (url !== this.lastPopUrl) {
      window.history.pushState(msg, msg.title, prefix + mod + url);
      this.lastPopUrl = undefined;
    } else if (change === 'load') {
      this.lastPopUrl = undefined;
    }
  }

  /* actions */
  addCookie = (name, value, domain) => {
    return this.sendMsg({ ws_type: 'addcookie', name, value, domain });
  }

  addPage = (page) => {
    return this.sendMsg({ ws_type: 'page', page });
  }

  addSkipReq = (url) => {
    return this.sendMsg({ ws_type: 'skipreq', url });
  }

  doAutoscroll = () => {
    return this.sendMsg({ ws_type: 'autoscroll' });
  }

  doLoadAll = () => {
    return this.sendMsg({ ws_type: 'load_all' });
  }

  setStatsUrls = (stats_urls) => {
    return this.sendMsg({ ws_type: 'config-stats', stats_urls });
  }

  snapshowReq = () => {
    return this.sendMsg({ ws_type: 'snowshot-req' });
  }

  setRemoteUrl = (url) => {
    return this.sendMsg({ ws_type: 'set_url', url });
  }

  switchMode = (rec, mode, msg) => {
    this.rec = rec;
    this.currMode = mode;

    // replaceOuterUrl(msg, type);

    return this.sendMsg({
      ws_type: 'switch',
      type: mode,
      rec
    });
  }
}

export default WebSocketHandler;
