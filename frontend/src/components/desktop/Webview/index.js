import React, { Component } from 'react';
import PropTypes from 'prop-types';
import WebSocketHandler from 'helpers/ws';
import classNames from 'classnames';
import { withRouter } from 'react-router';

import { apiFetch, stripProtocol, setTitle } from 'helpers/utils';
import { autopilotCheck, autopilotReset, autopilotReady, toggleAutopilot, updateBehaviorState, updateBehaviorMessage } from 'store/modules/automation';

import { setBrowserHistory } from 'store/modules/appSettings';
import { setMethod, updateTimestamp, updateUrl } from 'store/modules/controls';

import { appHost } from 'config';

import './style.scss';

const { ipcRenderer } = window.require('electron');


class Webview extends Component {
  static propTypes = {
    behavior: PropTypes.string,
    canGoBackward: PropTypes.bool,
    canGoForward: PropTypes.bool,
    dispatch: PropTypes.func,
    history: PropTypes.object,
    host: PropTypes.string,
    params: PropTypes.object,
    partition: PropTypes.string,
    timestamp: PropTypes.string,
    url: PropTypes.string,
  };

  static contextTypes = {
    coll: PropTypes.string,
    currMode: PropTypes.string,
    rec: PropTypes.string,
    user: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this.initialReq = true;
    this.socket = null;
    this.webviewHandle = null;
    this.internalUpdate = false;
    this.state = { loading: false };
  }

  componentDidMount() {
    const { currMode, user } = this.context;
    const { dispatch, host, params } = this.props;

    const realHost = host || appHost;

    this.clearCookies();

    this.socket = new WebSocketHandler(params, currMode, dispatch, false, '@INIT', stripProtocol(realHost));
    this.webviewHandle.addEventListener('ipc-message', this.handleIPCEvent);

    window.addEventListener('wr-go-back', this.goBack);
    window.addEventListener('wr-go-forward', this.goForward);
    window.addEventListener('wr-refresh', this.refresh);

    // ensure nav buttons disabled when new webview loads
    dispatch(setBrowserHistory('canGoBackward', false));
    dispatch(setBrowserHistory('canGoForward', false));

    this.webviewHandle.addEventListener('did-navigate-in-page', (event) => {
      if (event.isMainFrame) {
        dispatch(setMethod('history'));
        this.setUrl(event.url, true);
      }
    });

    this.webviewHandle.addEventListener('will-navigate', (event) => {
      this.clearCookies();
    });

    if (currMode === 'live') {
      this.webviewHandle.addEventListener('did-navigate', (event) => {
        this.setUrl(event.url, true);
        dispatch(setBrowserHistory('canGoBackward', this.webviewHandle.canGoBack()));
        dispatch(setBrowserHistory('canGoForward', this.webviewHandle.canGoForward()));
      });
    }

    ipcRenderer.on('toggle-devtools', this.toggleDevTools);
  }

  componentWillReceiveProps(nextProps) {
    const { behavior, timestamp, url } = this.props;

    // behavior check
    if (behavior !== nextProps.behavior) {
      this.doBehavior(nextProps.url, nextProps.behavior);
    }

    if (nextProps.url !== url || nextProps.timestamp !== timestamp) {
      if (!this.internalUpdate) {
        this.setState({ loading: true });
        this.clearCookies();
        this.webviewHandle.loadURL(this.buildProxyUrl(nextProps.url, nextProps.timestamp));
      }
      this.internalUpdate = false;
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.loading !== this.state.loading) {
      return true;
    }

    return false;
  }

  componentWillUnmount() {
    this.socket.close();
    this.webviewHandle.removeEventListener('ipc-message', this.handleReplayEvent);
    window.removeEventListener('wr-go-back', this.goBack);
    window.removeEventListener('wr-go-forward', this.goForward);
    window.removeEventListener('wr-refresh', this.refresh);

    ipcRenderer.removeListener('toggle-devtools', this.toggleDevTools);
  }

  buildProxyUrl(url, timestamp) {
    const { user, coll, rec, currMode } = this.context;
    if (currMode === "live") {
      return url;
    }
    let proxyUrl = `http://webrecorder.proxy/${user}/${coll}/`;
    if (rec) {
      proxyUrl += `${rec}/${currMode}/`;
    }
    if (timestamp) {
      proxyUrl += `${timestamp}/`;
    }
    proxyUrl += url;
    return proxyUrl;
  }

  clearCookies() {
    const { currMode } = this.context;

    if (currMode === 'replay-coll') {
      ipcRenderer.send('clear-cookies', true);
    }
  }

  openDroppedFile = (filename) => {
    if (filename && filename.match(/\.w?arc(\.gz)?|\.har$/)) {
      this.props.history.push('/');
      ipcRenderer.send('open-warc', filename);
    } else if (filename) {
      window.alert('Sorry, only WARC or ARC files (.warc, .warc.gz, .arc, .arc.gz) or HAR (.har) can be opened');
    }
  }

  toggleDevTools = (evt) => {
    if (!this.webviewHandle.isDevToolsOpened()) {
      this.webviewHandle.openDevTools();
    } else {
      this.webviewHandle.closeDevTools();
    }
  }

  doBehavior = (url, name) => {
    return this.sendMsg({ wb_type: 'behavior', url, name, start: !!name });
  }

  sendMsg = (msg) => {
    ipcRenderer.sendTo(this.webviewHandle.getWebContentsId(), 'wr-message', msg);
  }

  handleIPCEvent = (evt) => {
    const { canGoBackward, canGoForward, dispatch } = this.props;
    const { currMode } = this.context;
    const state = evt.args[0];

    // set back & forward availability
    if (canGoBackward !== this.webviewHandle.canGoBack()) {
      dispatch(setBrowserHistory('canGoBackward', this.webviewHandle.canGoBack()));
    }
    if (canGoForward !== this.webviewHandle.canGoForward()) {
      dispatch(setBrowserHistory('canGoForward', this.webviewHandle.canGoForward()));
    }

    switch(state.wb_type) {
      case 'open':
        this.openDroppedFile(state.filename);
        break;

      case 'load':
        this.setState({ loading: false });

        // no autopilot on replay
        if (currMode === 'replay-coll') {
          break;
        }

        if (state.newPage) {
          this.addNewPage(state, true);
        }
        if (state.readyState === 'interactive') {
          dispatch(setMethod('navigation'));
          dispatch(autopilotReset());
          dispatch(autopilotCheck(state.url));
        } else if (state.readyState === 'complete') {
          dispatch(autopilotReady());
        }
        break;

      case 'behaviorDone': // when autopilot is done running
        this.internalUpdate = true;
        dispatch(toggleAutopilot(null, 'complete', this.props.url));
        dispatch(updateBehaviorMessage('Behavior Done'));
        break;

      case 'behaviorStop': // when autopilot is manually stopped
        this.internalUpdate = true;
        dispatch(toggleAutopilot(null, 'stopped', this.props.url));
        dispatch(updateBehaviorMessage('Behavior Stopped By User'));
        break;

      case 'behaviorStep':
        this.internalUpdate = true;
        dispatch(updateBehaviorState(state.result));
        break;

      default:
        break;
    }
  }

  setUrl = (url, noStatsUpdate = false) => {
    const rawUrl = decodeURI(url);

    if (this.props.url !== rawUrl) {
      this.internalUpdate = true;
      this.props.dispatch(updateUrl(rawUrl));
    }

    if (!noStatsUpdate) {
      this.socket.setStatsUrls([rawUrl]);
    }
  }

  addNewPage = (state, doAdd = false) => {
    const { currMode } = this.context;
    const { params, timestamp } = this.props;

    // if (state && state.ts && currMode !== 'record' && currMode.indexOf('extract') === -1 && state.ts !== timestamp) {
    //   this.props.dispatch(updateTimestamp(state.ts));
    // }

    if (state.is_error) {
      this.setUrl(state.url);
    } else if (['record', 'patch', 'extract', 'extract_only'].includes(currMode)) {

      if (state.ts) {
        if (state.ts !== timestamp) {
          this.internalUpdate = true;
          this.props.dispatch(updateTimestamp(state.ts));
        }

        //window.wbinfo.timestamp = state.ts;
      }

      this.setUrl(state.url, true);

      const modeMsg = { record: 'recording', patch: 'Patching', extract: 'Extracting' };
      setTitle(currMode in modeMsg ? modeMsg[currMode] : '', state.url, state.tittle);

      if (doAdd && state.newPage && (state.ts || currMode !== 'patch')) {
        if (!this.socket.addPage(state)) {
          apiFetch(`/recording/${params.rec}/pages?user=${params.user}&coll=${params.coll}`, state, { method: 'POST' });
        }
      }
    } else if (['replay', 'replay-coll'].includes(currMode)) {
      if (!this.initialReq) {
        if (state.ts !== timestamp) {
          this.internalUpdate = true;
          this.props.dispatch(updateTimestamp(state.ts));
        }

        this.setUrl(state.url);
        setTitle('Archives', state.url, state.title);
      }
      this.initialReq = false;
    }
  }

  goBack = () => {
    if (this.webviewHandle.canGoBack()) {
      //this.webviewHandle.goToIndex(this.webviewHandle.getWebContents().getActiveIndex() - 1);
      this.webviewHandle.goBack();
    }
  }

  goForward = () => {
    if (this.webviewHandle.canGoForward()) {
      //this.webviewHandle.goToIndex(this.webviewHandle.getWebContents().getActiveIndex() + 1);
      this.webviewHandle.goForward();
    }
  }

  refresh = () => {
    this.clearCookies();
    this.webviewHandle.reload();
  }

  render() {
    const { loading } = this.state;
    const { partition, timestamp, url } = this.props;

    const classes = classNames('webview-wrapper', { loading });

    return (
      <div className={classes}>
        <webview
          id="replay"
          ref={(obj) => { this.webviewHandle = obj; }}
          src={this.buildProxyUrl(url, timestamp)}
          autosize="on"
          plugins="true"
          preload="preload.js"
          partition={partition} />
      </div>
    );
  }
}

export default withRouter(Webview);
