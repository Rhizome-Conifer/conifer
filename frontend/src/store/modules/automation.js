import { apiPath } from 'config';
import { fromJS } from 'immutable';


const INPAGE_CHECK = 'wr/automation/INPAGE_CHECK';
const INPAGE_CHECK_SUCCESS = 'wr/automation/INPAGE_CHECK_SUCCESS';
const INPAGE_CHECK_FAIL = 'wr/automation/INPAGE_CHECK_FAIL';

const INPAGE_TOGGLE_AUTOMATION = 'wr/automation/INPAGE_TOGGLE_AUTOMATION';

const NEW_AUTO = 'wr/automation/NEW_AUTO';
const NEW_AUTO_SUCCESS = 'wr/automation/NEW_AUTO_SUCCESS';
const NEW_AUTO_FAIL = 'wr/automation/NEW_AUTO_FAIL';

const QUEUE_AUTO = 'wr/automation/QUEUE_AUTO';
const QUEUE_AUTO_SUCCESS = 'wr/automation/QUEUE_AUTO_SUCCESS';
const QUEUE_AUTO_FAIL = 'wr/automation/QUEUE_AUTO_FAIL';

const TOGGLE_AUTOMATION = 'wr/automation/TOGGLE_AUTOMATION';
const TOGGLE_AUTOMATION_SUCCESS = 'wr/automation/TOGGLE_AUTOMATION_SUCCESS';
const TOGGLE_AUTOMATION_FAIL = 'wr/automation/TOGGLE_AUTOMATION_FAIL';

const TOGGLE_INPAGE_SIDEBAR = 'wr/automation/TOGGLE_INPAGE_SIDEBAR';

const TOGGLE_MODAL = 'wr/automation/TOGGLE_MODAL';


const initialState = fromJS({
  autoId: null,
  active: false,
  behavior: null,
  inpageAutomation: false,
  inpageRunning: false,
  inpageInfo: [],
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
    case INPAGE_CHECK_SUCCESS:
      return state.set('inpageInfo', fromJS(action.result));
    case INPAGE_TOGGLE_AUTOMATION:
      return state.merge({
        behavior: action.behavior,
        inpageRunning: action.running
      });
    case TOGGLE_INPAGE_SIDEBAR:
      return state.set('inpageAutomation', action.bool);
    default:
      return state;
  }
}


export function inpageCheck(url = '') {
  return {
    types: [INPAGE_CHECK, INPAGE_CHECK_SUCCESS, INPAGE_CHECK_FAIL],
    promise: client => client.get(`${apiPath}/behavior/info-list`, {
      params: { url }
    })
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


export function toggleInpageSidebar(bool) {
  return {
    type: TOGGLE_INPAGE_SIDEBAR,
    bool
  };
}


export function toggleInpageAutomation(behavior) {
  return {
    type: INPAGE_TOGGLE_AUTOMATION,
    behavior,
    running: behavior !== null
  };
}


export function toggleModal(bool) {
  return {
    type: TOGGLE_MODAL,
    bool
  };
}
