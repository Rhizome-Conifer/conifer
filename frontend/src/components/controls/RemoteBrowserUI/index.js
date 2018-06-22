import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';

import WebSocketHandler from 'helpers/ws';
import { deleteStorage, getStorage, remoteBrowserMod, setStorage } from 'helpers/utils';

import { createRemoteBrowser } from 'redux/modules/remoteBrowsers';

import CBrowser from 'shared/js/browser_controller';

import './style.scss';


class RemoteBrowserUI extends Component {

  static contextTypes = {
    currMode: PropTypes.string
  };

  static propTypes = {
    autoscroll: PropTypes.bool,
    clipboard: PropTypes.bool,
    dispatch: PropTypes.func,
    history: PropTypes.object,
    inactiveTime: PropTypes.number,
    params: PropTypes.object,
    rb: PropTypes.string,
    rec: PropTypes.string,
    reqId: PropTypes.string,
    sidebarResize: PropTypes.bool,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.reloadHandle = null;
    this.state = {
      countdownLabel: false,
      dismissCountdown: false,
      coutdown: '',
      message: '',
      messageSet: false
    };

    this.pywbParams = {
      audio: 1,
      static_prefix: '/static/',
      api_prefix: '/api/browsers',
      clipboard: '#clipboard',
      fill_window: true,
      on_countdown: this.onCountdown,
      on_event: this.onEvent
    };
  }

  componentDidMount() {
    const { dispatch, params, rb, rec, timestamp, url } = this.props;
    const { currMode } = this.context;

    if (!window.location.port) {
      this.pywbParams.proxy_ws = '_websockify?port=';
    }

    // TODO: Disable browser reuse for now
    // get any preexisting remote browsers from session storage,
    // checking whether they are stale. If so request a new one.
    const reqFromStorage = false; //this.getReqFromStorage(rb);

    // generate remote browser
    if (!reqFromStorage) {
      dispatch(createRemoteBrowser(rb, params.user, params.coll, rec, currMode, timestamp, url));
    } else {
      this.connectToRemoteBrowser(reqFromStorage.reqId, reqFromStorage.inactiveTime);
    }
  }

  componentWillReceiveProps(nextProps) {
    const { autoscroll, clipboard, dispatch, params, rb, reqId, timestamp, url } = this.props;
    const { currMode } = this.context;

    // bidirectional clipboard
    if (clipboard !== nextProps.clipboard && this.cb) {
      if (clipboard) {
        this.cb.destroy_clipboard();
      } else {
        this.cb.init_clipboard();
      }
    }

    if (autoscroll !== nextProps.autoscroll && this.socket) {
      this.socket.doAutoscroll();
    }

    if (nextProps.reqId !== reqId) {
      // new reqId for browser, initialize and save
      this.connectToRemoteBrowser(nextProps.reqId, nextProps.inactiveTime);

      // get any existing local browser sessions
      let existingData;
      try {
        existingData = JSON.parse(getStorage('reqId', window.sessionStorage) || '{}');
      } catch (e) {
        existingData = {};
      }
      const data = JSON.stringify({
        ...existingData,
        [rb]: {
          reqId: nextProps.reqId,
          accessed: Date.now(),
          inactiveTime: nextProps.inactiveTime
        }
      });

      // write to storage for later reuse
      setStorage('reqId', data, window.sessionStorage);
    } else if (nextProps.rb !== rb || url !== nextProps.url || timestamp !== nextProps.timestamp) {
      // TODO: Disable browser reuse for now
      // remote browser change request, load from storage or create a new one
      const reqFromStorage = false; // this.getReqFromStorage(nextProps.rb);

      // close current connections
      if (this.cb) {
        this.cb.close();
      }

      if (this.socket) {
        this.socket.close();
      }

      // generate remote browser
      if (!reqFromStorage) {
        dispatch(createRemoteBrowser(nextProps.rb, params.user, params.coll, nextProps.rec, currMode, nextProps.timestamp, nextProps.url));
      } else {
        this.connectToRemoteBrowser(reqFromStorage.reqId, reqFromStorage.inactiveTime);
      }
    }
  }

  componentWillUnmount() {
    if (this.cb) {
      this.cb.close();
    }

    if (this.socket) {
      this.socket.close();
    }

    clearTimeout(this.reloadHandle);
  }

  onCountdown = (seconds, countdownText) => {
    if (seconds <= 300) {
      this.setState({
        countdownLabel: true,
        countdown: countdownText
      });
    }

    if (seconds <= 60 && this.state.dismissCountdown) {
      this.setState({ dismissCountdown: false });
    }

    if (seconds <= 0) {
      this.recreateBrowser();
    }
  }

  onEvent = (type, data) => {
    const { dispatch, rb, params, rec, timestamp, url } = this.props;
    const { currMode } = this.context;

    if (type === 'connect') {
      this.setState({ message: '' });

      if (this.cb && document.activeElement && document.activeElement.tagName === 'INPUT') {
        this.cb.lose_focus();
      }
    }else if (['fail', 'expire'].includes(type)) {
      this.recreateBrowser();
    } else if (type === 'error') {
      deleteStorage('reqId', window.sessionStorage);
      dispatch(createRemoteBrowser(rb, params.user, params.coll, rec, currMode, timestamp, url));
    }
  }

  getReqFromStorage = (rb) => {
    /* Returns a browser info object if it exists in storage and hasn't expired,
       otherwise `null`.
     */
    let reqFromStorage;
    try {
      reqFromStorage = JSON.parse(getStorage('reqId', window.sessionStorage) || '{}');
    } catch (e) {
      console.log('error loading from storage', e);
      reqFromStorage = {};
    }

    return reqFromStorage[rb] && (Date.now() - reqFromStorage[rb].accessed) / 1000 < reqFromStorage[rb].inactiveTime ? reqFromStorage[rb] : null;
  }

  connectToRemoteBrowser = (reqId, inactiveTime) => {
    /* Connect to the initialized remote browser session and open the websocket
    */
    const { dispatch, params } = this.props;
    const { currMode } = this.context;

    this.pywbParams.inactiveSecs = inactiveTime;

    // set up socket
    this.socket = new WebSocketHandler(params, currMode, dispatch, true, reqId);

    // connect to rb
    // TODO: Make sure this is being destroyed properly
    this.cb = new CBrowser(reqId, '#browser', this.pywbParams);
    window.cb = this.cb;
  }

  recreateBrowser = () => {
    const { currMode } = this.context;
    const { history, params: { user, coll, rec }, rb, timestamp, url } = this.props;
    let message;

    if (currMode === 'record') {
      if (this.state.messageSet) {
        return;
      }

      const collUrl = `/${user}/${coll}/`;
      message = (
          `Sorry, the remote browser recording session has expired.<br />
          You can <a href="${collUrl}index?query=session:${rec}">view the recording</a> or <a href="${collUrl}$new">create a new recording</a>`
      );

      this.setState({
        message,
        messageSet: true
      });

      return;
    }

    message = `The remote browser session has expired, ${currMode === 'patch' ? 'transitioning to replay' : 'requesting a new browser'}`;
    this.setState({
      message
    });


    this.reloadHandle = setTimeout(() => {
      if (currMode === 'patch') {
        history.push(`/${user}/${coll}/${remoteBrowserMod(rb, timestamp, '/')}${url}`);
      } else {
        window.location.reload();
      }
    }, 5000);
  }

  hideCountdown = () => this.setState({ dismissCountdown: true })

  render() {
    const { sidebarResize } = this.props;
    const { countdown, countdownLabel, dismissCountdown, message } = this.state;

    return (
      <React.Fragment>
        {
          message &&
            <Alert className="rb-message">
              <div dangerouslySetInnerHTML={{ __html: message }} />
            </Alert>
        }
        {
          !message && countdownLabel && !dismissCountdown &&
            <Alert bsStyle="warning" className="rb-countdown" onDismiss={this.hideCountdown}>
              Browser Time Left: <b>{countdown}</b>
            </Alert>
        }
        <div id="message" key="msg" className="browser" />
        <div id="browser" key="browser" className="browser" style={sidebarResize ? { pointerEvents: 'none' } : {}} />
      </React.Fragment>
    );
  }
}

export default RemoteBrowserUI;
