import { apiPath } from 'config';
import { fromJS } from 'immutable';


const NEW_AUTO = 'wr/NEW_AUTO';
const NEW_AUTO_SUCCESS = 'wr/NEW_AUTO_SUCCESS';
const NEW_AUTO_FAIL = 'wr/NEW_AUTO_FAIL';

const QUEUE_AUTO = 'wr/QUEUE_AUTO';
const QUEUE_AUTO_SUCCESS = 'wr/QUEUE_AUTO_SUCCESS';
const QUEUE_AUTO_FAIL = 'wr/QUEUE_AUTO_FAIL';

const TOGGLE_AUTOMATION = 'wr/TOGGLE_AUTOMATION';
const TOGGLE_AUTOMATION_SUCCESS = 'wr/TOGGLE_AUTOMATION_SUCCESS';
const TOGGLE_AUTOMATION_FAIL = 'wr/TOGGLE_AUTOMATION_FAIL';

const TOGGLE_MODAL = 'wr/TOGGLE_MODAL';


const initialState = fromJS({
  autoId: null,
  active: false,
  queued: false,
  show: false,
  workers: []
});


export default function automation(state = initialState, action = {}) {
  switch (action.type) {
    case NEW_AUTO_SUCCESS:
      return state.set('autoId', action.result.auto);
    case QUEUE_AUTO_SUCCESS:
      return state.set('queued', true);
    case TOGGLE_MODAL:
      return state.set('show', typeof action.bool !== 'undefined' ? action.bool : !state.get('show'));
    case TOGGLE_AUTOMATION_SUCCESS:
      return state.merge({
        active: action.mode === 'start',
        workers: action.result.browsers || []
      });
    default:
      return state;
  }
}


export function toggleModal(bool) {
  return {
    type: TOGGLE_MODAL,
    bool
  };
}


export function newAutomation(user, coll, crawl_depth = 0, scope = 'single-page', num_browsers = 1) {
  return {
    types: [NEW_AUTO, NEW_AUTO_SUCCESS, NEW_AUTO_FAIL],
    promise: client => client.post(`${apiPath}/auto`, {
      params: { user, coll },
      data: {
        crawl_depth,
        num_browsers,
        scope
      }
    })
  };
}


export function queueAutomation(user, coll, aid, urls) {
  return {
    types: [QUEUE_AUTO, QUEUE_AUTO_SUCCESS, QUEUE_AUTO_FAIL],
    promise: client => client.post(`${apiPath}/auto/${aid}/queue_urls`, {
      params: { user, coll },
      data: {
        urls
      }
    })
  };
}


export function toggleAutomation(mode, user, coll, aid) {
  return {
    types: [TOGGLE_AUTOMATION, TOGGLE_AUTOMATION_SUCCESS, TOGGLE_AUTOMATION_FAIL],
    promise: client => client.post(`${apiPath}/auto/${aid}/${mode}`, {
      params: { user, coll }
    }),
    mode
  };
}
