import { setSizeCounter } from 'redux/modules/sizeCounter';
import { setStats } from 'redux/modules/infoWidget';

import config from 'config';


class WebSocketHandler {
  constructor(params, currMode, dispatch) {
    const { user, coll, rec, splat } = params;

    this.startMsg = undefined;
    this.currMode = currMode;
    this.user = user;
    this.coll = coll;
    this.rec = rec;
    this.reqUrl = splat;
    this.useWS = false;
    this.dispatch = dispatch;

    this.isProxy = false;

    this.initWS();
  }

  initWS = () => {
    console.log('init ws');
    const protocol = window.location.protocol === 'https' ? 'wss://' : 'ws://';
    let url = `${protocol}${config.devApi.replace('http://', '')}/_client_ws?user=${this.user}&coll=${this.coll}&type=${this.currMode}&url=${encodeURIComponent(this.reqUrl)}`;

    if(this.rec && this.rec !== '*') {
      url += `&rec=${this.rec}`;
    }

    if (window.reqid) {
      url += `&reqid=${window.reqid}`;
    }

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
        console.log('ws received status message', msg);
        this.dispatch(setSizeCounter(msg.size));

        if (this.currMode.indexOf('replay') !== -1) {
          // setBookmarkStats(msg.numPages);
        }

        if (msg.stats || msg.size) {
          this.dispatch(setStats(msg.stats, msg.size));
        }
        break;
      case 'remote_url':
        /*
        if (window.cnt_browser) {
          var page = msg.page;
          setTimestamp(page.timestamp);
          setUrl(page.url);
          setTitle("Remote", page.url, page.title);
          replaceOuterUrl(page, "load");
        }
         */
        break;
      case 'patch_req':
        /*
        if (window.cnt_browser) {
          if (window.curr_mode == "replay-coll" || window.curr_mode == "replay") {
            EventHandlers.switchCBPatch(getUrl());
          }
        }*/
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

  /* actions */
  addCookie = (name, value, domain) => {
    return this.sendMsg({ ws_type: 'addcookie', name, value, domain });
  }

  addPage = (page) => {
    console.log('addPage', page);
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
