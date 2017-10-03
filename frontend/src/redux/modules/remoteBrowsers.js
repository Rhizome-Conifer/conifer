import { fromJS } from 'immutable';
import config from 'config';

const RB_CREATE_BROWSER = 'wr/rb/CREATE_BROWSER';
const RB_CREATE_BROWSER_SUCCESS = 'wr/rb/CREATE_BROWSER_SUCCESS';
const RB_CREATE_BROWSER_FAILURE = 'wr/rb/CREATE_BROWSER_FAILURE';
const RB_SELECT = 'wr/rb/SELECT';
const RB_LOAD = 'wr/rb/LOAD';
const RB_LOAD_SUCCESS = 'wr/rb/LOAD_SUCCESS';
const RB_LOAD_FAIL = 'wr/rb/LOAD_FAIL';

const initialState = fromJS({
  activeBrowser: null,
  accessed: null,
  browserData: null,
  error: null,
  inactiveTime: null,
  loaded: false,
  recId: null
});

export default function remoteBrowsers(state = initialState, action = {}) {
  switch (action.type) {
    case RB_CREATE_BROWSER_SUCCESS: {
      const { reqid, browser_data, inactive_time } = action.result;

      return state.merge({
        reqId: reqid,
        browserData: browser_data,
        inactiveTime: inactive_time
      });
    }
    case RB_CREATE_BROWSER_FAILURE:
      return state;
    case RB_LOAD:
      return state.set('loading', true);
    case RB_LOAD_SUCCESS:
      return state.merge({
        loading: false,
        loaded: true,
        browsers: action.result,
        accessed: action.accessed,
        error: null
      });
    case RB_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case RB_SELECT:
      return state.set('activeBrowser', action.id);
    default:
      return state;
  }
}

export function createRemoteBrowser(br, user, coll, rec, mode, urlFrag) {
  const args = `br=${br}&user=${user}&coll=${coll}&rec=${rec}&mode=${mode}&wb_url=${urlFrag}`;

  return {
    types: [RB_CREATE_BROWSER, RB_CREATE_BROWSER_SUCCESS, RB_CREATE_BROWSER_FAILURE],
    promise: client => client.get(`${config.apiPath}/create_remote_browser?${args}`)
  };
}

export function isLoaded(globalState) {
  return globalState.get('remoteBrowsers') &&
         globalState.getIn(['remoteBrowsers', 'loaded']) &&
         Date.now() - globalState.getIn(['remoteBrowsers', 'accessed']) < 15 * 60 * 1000;
}

export function load() {
  return {
    types: [RB_LOAD, RB_LOAD_SUCCESS, RB_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get('/api/browsers/browsers')
  };
}

export function selectBrowser(id) {
  return {
    type: RB_SELECT,
    id
  };
}
