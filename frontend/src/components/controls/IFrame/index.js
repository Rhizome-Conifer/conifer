import React, { Component } from 'react';
import PropTypes from 'prop-types';

import ContentFrame from 'shared/js/wb_frame';
import WebSocketHandler from 'helpers/ws';
import config from 'config';

import { setTitle } from 'helpers/utils';
import { showModal } from 'redux/modules/bugReport';

import './style.scss';


class IFrame extends Component {
  static propTypes = {
    dispatch: PropTypes.func,
    params: PropTypes.object,
    prefix: PropTypes.string,
    updateSizeCounter: PropTypes.func
  };

  static contextTypes = {
    currMode: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.initialReq = false;
    this.socket = null;

    this.contentFrame = null;
    this.frameContainer = null;
  }

  componentDidMount() {
    const { dispatch, params, prefix } = this.props;
    const { currMode } = this.context;

    window.addEventListener('message', this.handleReplayEvent);

    // TODO: fill out wbinfo
    window.wbinfo = {
      outer_prefix: '',
      prefix,
      coll: params.coll,
      //url,
      capture_url: '',
      reqTimestamp: params.ts,
      timestamp: params.ts,
      is_frame: true,
      frame_mod: '',
      replay_mod: '',
      state: currMode,
      sources: [],
      inv_sources: '',
      info: {}
    };

    this.contentFrame = new ContentFrame({
      url: params.splat + window.location.hash,
      prefix,
      requests_ts: params.ts,
      iframe: this.iframe
    });

    this.socket = new WebSocketHandler(params, currMode, dispatch);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.splat !== this.props.params.splat ||
        nextProps.params.ts !== this.props.params.ts) {
      this.contentFrame.load_url(nextProps.params.splat, nextProps.params.ts);
    }
  }

  componentWillUnmount() {
    this.contentFrame.close();
    window.removeEventListener('message', this.handleReplayEvent);
    this.socket = null;
  }

  setDomainCookie = (state) => {
    const url = window.location.origin;

    let cookie = state.cookie.split(';', 1)[0];
    if (!cookie) {
      return;
    }
    cookie = cookie.split('=', 2);

    if (!this.socket.addCookie(cookie[0], cookie[1], state.domain)) {
      // TODO: ajax fallback
    }
  }

  setUrl = (url, noStatsUpdate = false) => {
    const { currMode } = this.context;
    const rawUrl = decodeURI(url);

    // this.props.dispatch(setUrl(rawUrl));

    if (currMode.indexOf('replay') !== -1) {
      // PagingInterface.navigationUpdate();
    } else if (['record', 'patch', 'extract'].includes(currMode)) {
      // ShareWidget.updateUrl({url: rawUrl, ts: wbinfo.timestamp });
    }

    if (!noStatsUpdate) {
      this.socket.setStatsUrls([rawUrl]);
    }
  }

  handleReplayEvent = (evt) => {
    // ignore postMessages from other sources
    if (evt.origin.indexOf(config.contentHost) === -1 || typeof evt.data !== 'object') {
      return;
    }

    const state = evt.data;
    const specialModes = ['cookie', 'skipreq', 'bug-report'].indexOf(state.wb_type) !== -1;

    if (!this.iframe || (evt.source !== this.iframe.contentWindow && !specialModes)) {
      return;
    }

    switch(state.wb_type) {
      case 'load':
        this.addNewPage(state);
        break;
      case 'cookie':
        this.setDomainCookie(state);
        break;
      case 'snapshot':
        break;
      case 'skipreq':
        this.addSkipReq(state);
        break;
      case 'hashchange': {
        let url = this.props.params.splat.split("#", 1)[0];
        if (state.hash) {
          url = state.hash;
        }
        // setUrl(url);
        break;
      }
      case 'bug-report':
        this.props.dispatch(showModal());
        break;
      default:
        break;
    }
  }

  addNewPage = (state) => {
    const { currMode } = this.context;
    console.log('wr add new page');

    if (state && state.ts && currMode !== 'record' && currMode !== 'extract') {
      // updateTimestamp(state.ts, window.curr_mode.indexOf("replay") !== -1);
    }

    if (state.is_error) {
      // setUrl(state.url);
    } else if (['record', 'patch', 'extract'].includes(currMode)) {
      const recordingId = window.wbinfo.info.rec_id;
      const attributes = {};

      if (state.ts) {
        attributes.timestamp = state.ts;
        // setTimestamp(state.ts);
        window.wbinfo.timestamp = state.ts;
      }

      attributes.title = state.title;
      attributes.url = state.url;
      this.setUrl(state.url, true);

      const modeMsg = { record: 'recording', patch: 'Patching', extract: 'Extracting' };
      setTitle(currMode in modeMsg ? modeMsg[currMode] : '', state.url, state.tittle);

      if (attributes.timestamp || currMode !== 'patch') {
        if (!this.socket.addPage(attributes)) {
          // TODO: addPage fallback
          // addPage(recordingId, attributes);
        }
      }
    } else if (['replay', 'replay-coll'].includes(currMode)) {
      if (!this.initialReq) {
        // setTimestamp(state.ts);
        this.setUrl(state.url);
        setTitle('Archives', state.url, state.title);
      }
      this.initialReq = false;
    }
  }

  addSkipReq = (state) => {
    if (!this.socket.addSkipReq(state.url)) {
      // TODO: ajax fallback
    }
  }

  render() {
    return (
      <iframe className="wb_iframe" ref={(obj) => { this.iframe = obj; }} />
    );
  }
}


export default IFrame;
