import config from 'config';
import { fromJS } from 'immutable';

const CTRLS_SET_MODE = 'wr/ctrls/SET_MODE';
const CTRLS_SET_EXTRACTABLE = 'wr/ctrls/SET_EXTRACTABLE';
const CTRLS_SET_ALL_SOURCES = 'wr/ctrls/SET_ALL_SOURCES';
const CTRLS_SET_SOURCES = 'wr/ctrls/SET_SOURCES';
const CTRLS_SET_URL = 'wr/ctrls/CTRLS_SET_URL';
const CTRLS_SET_TS = 'wr/ctrls/CTRLS_SET_TS';

const CTRLS_GET_ARCHIVES = 'wr/ctrls/ARCHIVES';
const CTRLS_GET_ARCHIVES_SUCCESS = 'wr/ctrls/ARCHIVES_SUCCESS';
const CTRLS_GET_ARCHIVES_FAIL = 'wr/ctrls/ARCHIVES_FAIL';


const initialState = fromJS({
  mode: null,
  extractable: null,
  archivesLoading: false,
  archivesAccessed: null,
  archives: [],
  archiveSources: []
});

export default function controls(state = initialState, action = {}) {
  switch(action.type) {
    case CTRLS_GET_ARCHIVES:
      return state.set('archivesLoading', true);
    case CTRLS_GET_ARCHIVES_SUCCESS:
      return state.merge({
        archivesLoading: false,
        archivesAccessed: action.accessed,
        archives: action.result
      });
    case CTRLS_GET_ARCHIVES_FAIL:
      return state.merge({
        archivesLoading: false,
        error: action.error
      });

    case CTRLS_SET_MODE:
      return state.set('mode', action.mode);
    case CTRLS_SET_EXTRACTABLE:
      return state.merge({
        extractable: action.extractable
      });
    case CTRLS_SET_SOURCES:
      return state.set('archiveSources', action.sources);
    case CTRLS_SET_ALL_SOURCES:
      return state.setIn(['extractable', 'allSources'], action.useAllSourcesBool);
    case CTRLS_SET_URL:
      return state.set('url', action.url);
    case CTRLS_SET_TS:
      return state.set('timestamp', action.ts);

    default:
      return state;
  }
}

export function getArchives() {
  return {
    types: [CTRLS_GET_ARCHIVES, CTRLS_GET_ARCHIVES_SUCCESS, CTRLS_GET_ARCHIVES_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${config.apiPath}/client_archives`)
  };
}

export function setExtractable(extractable) {
  return {
    type: CTRLS_SET_EXTRACTABLE,
    extractable
  };
}

export function setMode(mode) {
  return {
    type: CTRLS_SET_MODE,
    mode
  };
}

export function setAllSourcesOption(useAllSourcesBool) {
  return {
    type: CTRLS_SET_ALL_SOURCES,
    useAllSourcesBool
  };
}

export function setActiveSources(sources) {
  return {
    type: CTRLS_SET_SOURCES,
    sources
  };
}

export function updateUrl(url) {
  return {
    type: CTRLS_SET_URL,
    url
  };
}

export function updateTimestamp(ts) {
  return {
    type: CTRLS_SET_TS,
    ts
  };
}

