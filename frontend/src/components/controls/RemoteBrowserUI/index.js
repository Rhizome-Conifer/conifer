import React, { Component } from 'react';
import PropTypes from 'prop-types';

import WebSocketHandler from 'helpers/ws';
import { deleteStorage, getStorage, setStorage } from 'helpers/utils';
import { createRemoteBrowser } from 'redux/modules/remoteBrowsers';

import CBrowser from 'shared/js/browser_controller';


class RemoteBrowser extends Component {

  static contextTypes = {
    currMode: PropTypes.string
  };

  static propTypes = {
    dispatch: PropTypes.func,
    inactiveTime: PropTypes.number,
    params: PropTypes.object,
    rb: PropTypes.string,
    rec: PropTypes.string,
    reqId: PropTypes.string,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = {
      countdownLabel: false,
      coutdown: '',
      message: '',
      messageSet: false
    };

    this.pywbParams = {
      static_prefix: '/static/browsers/',
      api_prefix: '/api/browsers'
    };

    this.pywbParams.clipboard = '#clipboard';
    this.pywbParams.fill_window = false;
    this.pywbParams.static_prefix = '/shared/';

    // event callbacks
    this.pywbParams.on_countdown = this.onCountdown;
    this.pywbParams.on_event = this.onEvent;

    /* TODO:
    $("#report-modal").on("shown.bs.modal", function () {
        cb.lose_focus();
    });

    $("input").on("click", function() {
        cb.lose_focus();
    });
    */
  }

  componentDidMount() {
    const { dispatch, params, rb, rec, timestamp, url } = this.props;
    const { currMode } = this.context;

    if (!window.location.port) {
      this.pywbParams.proxy_ws = '_websockify?port=';
    }

    // get any preexisting remote browsers from session storage,
    // checking whether they are stale. If so request a new one.
    const reqFromStorage = this.getReqFromStorage(rb);

    // generate remote browser
    if (!reqFromStorage) {
      dispatch(createRemoteBrowser(rb, params.user, params.coll, rec, currMode, `${timestamp}/${url}`));
    } else {
      this.connectToRemoteBrowser(reqFromStorage.reqId, reqFromStorage.inactiveTime);
    }
  }

  componentWillReceiveProps(nextProps) {
    const { dispatch, params, rb, rec, reqId, timestamp, url } = this.props;
    const { currMode } = this.context;

    if (nextProps.reqId !== reqId && nextProps.rb === rb) {
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
    } else if(nextProps.rb !== rb) {
      // remote browser change request, load from storage or create a new one
      const reqFromStorage = this.getReqFromStorage(nextProps.rb);

      // close current connections
      this.cb.close();
      this.socket.close();

      // generate remote browser
      if (!reqFromStorage) {
        dispatch(createRemoteBrowser(nextProps.rb, params.user, params.coll, rec, currMode, `${timestamp}/${url}`));
      } else {
        this.connectToRemoteBrowser(reqFromStorage.reqId, reqFromStorage.inactiveTime);
      }
    }
  }

  componentWillUnmount() {
    this.cb.close();
    this.socket.close();
  }

  onCountdown = (seconds, countdownText) => {
    if (seconds <= 300) {
      this.setState({
        countdownLabel: true,
        countdown: countdownText
      });
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
      dispatch(createRemoteBrowser(rb, params.user, params.coll, rec, currMode, `${timestamp}/${url}`));
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
    this.cb = new CBrowser(reqId, '#browser', this.pywbParams);
    window.cb = this.cb;
  }

  recreateBrowser = () => {
    const { currMode } = this.context;
    const { params: { user, coll, rec } } = this.props;
    let message;

    if (currMode === 'record') {
      if (this.state.messageSet) {
        return;
      }

      const collUrl = `/${user}/${coll}`;
      message = (
        `Sorry, the remote browser recording session has expired.<br />` +
        `You can <a href="${collUrl}/${rec}">view the recording</a> or <a href="${collUrl}/$new">create a new recording</a>`
      );

      this.setState({
        message,
        messageSet: true
      });

      // TODO: set in global state
      window.containerExpired = true;
      return;
    }

    message = 'The remote browser session has expired, requesting a new browser';
    this.setState({
      message
    });

    const url = `/_message?message=${message}&msg_type=warning`;
    fetch(url).then((res) => {
      if (currMode === 'patch') {
        // RouteTo.replayRecording(user, coll, cbrowserMod(), url);
      } else {
        // TODO: better way?
        window.location.reload();
      }
    });
  }

  render() {
    const { message } = this.state;
    return (
      <div>
        <div id="message" className="browser" />
        <div id="browser" className="browser" />
      </div>
    );
  }
}

export default RemoteBrowser;
