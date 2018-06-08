import config from 'config';
import { fromJS } from 'immutable';


const ACTIVE_LIST = 'wr/ctrls/ACTIVE_LIST';
const SET_AUTOSCROLL = 'wr/ctrls/SET_AUTOSCROLL';
const SET_MODE = 'wr/ctrls/SET_MODE';
const SET_EXTRACTABLE = 'wr/ctrls/SET_EXTRACTABLE';
const SET_ALL_SOURCES = 'wr/ctrls/SET_ALL_SOURCES';
const SET_SOURCES = 'wr/ctrls/SET_SOURCES';
const SET_URL = 'wr/ctrls/SET_URL';
const SET_TS = 'wr/ctrls/SET_TS';
const SET_URL_TS = 'wr/ctrls/SET_URL_TS';
const SET_BK_ID = 'wr/ctrls/SET_BK_ID';
const SET_404 = 'wr/ctrls/SET_404';

const GET_ARCHIVES = 'wr/ctrls/ARCHIVES';
const GET_ARCHIVES_SUCCESS = 'wr/ctrls/ARCHIVES_SUCCESS';
const GET_ARCHIVES_FAIL = 'wr/ctrls/ARCHIVES_FAIL';


const initialState = fromJS({
  mode: null,
  activeList: null,
  activeBookmarkId: null,
  autoscroll: false,
  extractable: null,
  archivesLoading: false,
  archivesAccessed: null,
  archives: [],
  archiveSources: [],
  contentFrameUpdate: true,
  is404: false
});

export default function controls(state = initialState, action = {}) {
  switch(action.type) {
    case ACTIVE_LIST:
      return state.set('activeList', action.slug);
    case GET_ARCHIVES:
      return state.set('archivesLoading', true);
    case GET_ARCHIVES_SUCCESS:
      return state.merge({
        archivesLoading: false,
        archivesAccessed: action.accessed,
        archives: fromJS(action.result)
      });
    case GET_ARCHIVES_FAIL:
      return state.merge({
        archivesLoading: false,
        error: action.error
      });
    case SET_404:
      return state.set('is404', action.bool);
    case SET_AUTOSCROLL:
      return state.set('autoscroll', action.bool);
    case SET_BK_ID:
      return state.set('activeBookmarkId', action.id);
    case SET_MODE:
      return state.set('mode', action.mode);
    case SET_EXTRACTABLE:
      return state.merge({
        extractable: fromJS(action.extractable)
      });
    case SET_SOURCES:
      return state.set('archiveSources', action.sources);
    case SET_ALL_SOURCES:
      return state.setIn(['extractable', 'allSources'], action.useAllSourcesBool);
    case SET_URL:
      return state.set('url', action.url);
    case SET_TS:
      return state.set('timestamp', action.ts);
    case SET_URL_TS:
      return state.merge({
        url: action.url,
        timestamp: action.ts,
        title: action.title,
        contentFrameUpdate: action.internal
      });
    default:
      return state;
  }
}


export function getArchives(host = '') {
  return {
    types: [GET_ARCHIVES, GET_ARCHIVES_SUCCESS, GET_ARCHIVES_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${host}${config.apiPath}/client_archives`)
  };
}


export function setAutoscroll(bool) {
  return {
    type: SET_AUTOSCROLL,
    bool
  };
}


export function setExtractable(extractable) {
  return {
    type: SET_EXTRACTABLE,
    extractable
  };
}


export function setMode(mode) {
  return {
    type: SET_MODE,
    mode
  };
}


export function setList(slug) {
  return {
    type: ACTIVE_LIST,
    slug
  };
}


export function setBookmarkId(id) {
  return {
    type: SET_BK_ID,
    id
  };
}


export function setAllSourcesOption(useAllSourcesBool) {
  return {
    type: SET_ALL_SOURCES,
    useAllSourcesBool
  };
}


export function setActiveSources(sources) {
  return {
    type: SET_SOURCES,
    sources
  };
}


export function set404(bool) {
  return {
    type: SET_404,
    bool
  };
}


export function updateUrl(url) {
  return {
    type: SET_URL,
    url
  };
}


export function updateUrlAndTimestamp(url, ts, title = '', internal = true) {
  return {
    type: SET_URL_TS,
    internal,
    title,
    ts,
    url
  };
}


export function updateTimestamp(ts) {
  return {
    type: SET_TS,
    ts
  };
}
