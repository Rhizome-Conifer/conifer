import { fromJS } from 'immutable';

const SET_HISTORY = 'wr/appSettings/SET_HISTORY';
const SET_HOST = 'wr/appSettings/SET_HOST';
const SET_SOURCE = 'wr/appSettings/SET_SOURCE';

// see if host is stored in sessionStorage or null
const initialState = fromJS({
  host: __PLAYER__ ? window.sessionStorage.getItem('_wr_host') : '',
  canGoForward: false,
  canGoBackward: false
});

export default function appSettings(state = initialState, action = {}) {
  switch(action.type) {
    case SET_HISTORY:
      return state.set(action.method, action.bool);
    case SET_HOST:
      return state.set('host', action.host);
    case SET_SOURCE:
      return state.set('source', action.source);
    default:
      return state;
  }
}


export function setBrowserHistory(method, bool) {
  return {
    type: SET_HISTORY,
    method,
    bool
  };
}

export function setHost(host) {
  window.sessionStorage.setItem('_wr_host', host);
  return {
    type: SET_HOST,
    host
  };
}

export function setSource(source) {
  return {
    type: SET_SOURCE,
    source
  };
}
