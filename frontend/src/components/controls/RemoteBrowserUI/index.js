import React, { Component } from 'react';
import PropTypes from 'prop-types';

import CBrowser from 'shared/js/browser_controller';


class RemoteBrowser extends Component {

  static contextTypes = {
    currMode: PropTypes.string
  };

  static propTypes = {
    params: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      countdownLabel: false,
      coutdown: '',
      message: '',
      messageSet: false
    };

    this.params = {
      static_prefix: '/static/browsers/',
      api_prefix: '/api/browsers'
    };

    if (!window.location.port) {
      this.params.proxy_ws = '_websockify?port=';
    }

    // event callbacks
    this.params.onCountdown = this.onCountdown;
    this.params.onEvent = this.onEvent;

    // TODO: get from api
    this.params.inactiveSecs = window.inacticeSecs;
    this.params.clipboard = '#clipboard';
    this.params.fill_window = false;

    // TODO: reqid in global state/localStorage?
    this.cb = new CBrowser(window.reqid, '#browser', this.params);

    /* TODO:
    $("#report-modal").on("shown.bs.modal", function () {
        cb.lose_focus();
    });

    $("input").on("click", function() {
        cb.lose_focus();
    });
    */
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
    if (type === 'connect') {
      this.setState({ message: '' });

      if (this.cb && document.activeElement && document.activeElement.tagName === 'INPUT') {
        this.cb.lose_focus();
      }
    }else if (['fail', 'expire'].includes(type)) {
      this.recreateBrowser();
    }
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
    return (
      <div>
        <div id="message" className="browser" />
        <div id="browser" className="browser" />
      </div>
    );
  }
}

export default RemoteBrowser;
