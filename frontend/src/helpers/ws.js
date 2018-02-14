import { updateUrl, updateTimestamp } from 'redux/modules/controls';
import { setSizeCounter } from 'redux/modules/sizeCounter';
import { setStats } from 'redux/modules/infoStats';

import config from 'config';

import { getRemoteBrowser, remoteBrowserMod, stripProtocol } from 'helpers/utils';


class WebSocketHandler {
  constructor(params, currMode, dispatch, remoteBrowser = false, reqId = null, host = '') {
    const { user, coll, rec, splat, ts, br } = params;

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
    this.host = host;

    this.isProxy = false;
    this.isRemoteBrowser = remoteBrowser;
    this.br = null;
    this.reqId = reqId;
    this.wsEndpoint = '_client_ws';

    if (this.isRemoteBrowser) {
      // br from write modes, ts modified from replay
      this.br = getRemoteBrowser(br || ts);
      window.addEventListener('popstate', this.syncOuterFrameState);
    }

    this.initWS();
  }

  initWS = () => {
    console.log('init ws', this.reqUrl);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    let url = `${wsProtocol}${this.host ? this.host : stripProtocol(config.apiEndpoint)}/${this.wsEndpoint}?user=${this.user}&coll=${this.coll}`;

    if(this.rec && this.rec !== '*') {
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

    if (this.isRemoteBrowser) {
      window.removeEventListener('popstate', this.syncOuterFrameState);
    }

    return this.ws.close();
  }

  hasWS = _ => this.useWS;

  wsOpened = () => {
    this.useWS = true;
    this.errCount = 0;
    if (this.startMsg) {
      this.sendMsg(this.startMsg);
    }
  }

  wsClosed = (evt) => {
    this.useWS = false;
    if (this.errCount < 5) {
      this.errCount += 1;
      setTimeout(this.initWS, 2000);
    }
  }

  wsReceived = (evt) => {
    const msg = JSON.parse(evt.data);

    switch (msg.ws_type) {
      case 'status':
        this.dispatch(setSizeCounter(msg.size));

        if (this.currMode.indexOf('replay') !== -1) {
          // setBookmarkStats(msg.numPages);
        }

        if (msg.stats || msg.size) {
          this.dispatch(setStats(msg.stats, msg.size));
        }
        break;
      case 'remote_url': {
        if (this.isRemoteBrowser) {
          const page = msg.page;
          this.dispatch(updateTimestamp(page.timestamp));
          this.dispatch(updateUrl(page.url));

          //setTitle("Remote", page.url, page.title);
          this.replaceOuterUrl(page, "load");
        }
        break;
      }
      case 'patch_req':
        console.log('patch_req', msg);
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
    if (evt && evt.state) {
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

  /* proxy specific fns */
  sendLocalMsg = (msg) => {
    window.dispatchEvent(new CustomEvent("__wb_to_event", {detail: msg}));
  }

  sendPageMsg = (isAdd) => {
    const page = {
      url: window.location.href,
      timestamp: window.wbinfo.timestamp,
      title: document.title,
      browser: window.wbinfo.curr_browser
    };

    const msg = { page };

    if (isAdd) {
      msg.ws_type = 'page';
      msg.visible = !document.hidden;
    } else {
      msg.ws_type = 'remote_url';
    }

    return this.sendMsg(msg);
  }

  replaceOuterUrl = (msg, change) => {
    const ts = msg.timestamp;
    const mod = remoteBrowserMod(this.br, this.currMode.indexOf('replay') !== -1 && ts ? ts : null, '/');
    const url = msg.url;
    let prefix;

    if (this.currMode.indexOf('replay') !== -1) {
      prefix = `${config.appHost}/${this.user}/${this.coll}/`;
    } else {
      // TODO: build extract prefix
      prefix = `${config.appHost}/${this.user}/${this.coll}/${this.rec}/${this.currMode}/`;
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
