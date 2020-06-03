import { apiPath } from 'config';
import { fromJS, List, Map } from 'immutable';


const AUTOPILOT_CHECK = 'wr/automation/AUTOPILOT_CHECK';
const AUTOPILOT_CHECK_SUCCESS = 'wr/automation/AUTOPILOT_CHECK_SUCCESS';
const AUTOPILOT_CHECK_FAIL = 'wr/automation/AUTOPILOT_CHECK_FAIL';

const AUTOPILOT_READY = 'wr/automation/AUTOPILOT_READY';

const AUTOPILOT_RESET = 'wr/automation/AUTOPILOT_RESET';

const AUTOPILOT_TOGGLE_AUTOMATION = 'wr/automation/AUTOPILOT_TOGGLE_AUTOMATION';
const AUTOPILOT_UPDATE_BEHAVIOR_STATUS = 'wr/automation/AUTOPILOT_UPDATE_BEHAVIOR_STATUS';
const AUTOPILOT_UPDATE_BEHAVIOR_MESSAGE = 'wr/automation/AUTOPILOT_UPDATE_BEHAVIOR_MESSAGE';

const NEW_AUTO = 'wr/automation/NEW_AUTO';
const NEW_AUTO_SUCCESS = 'wr/automation/NEW_AUTO_SUCCESS';
const NEW_AUTO_FAIL = 'wr/automation/NEW_AUTO_FAIL';

const QUEUE_AUTO = 'wr/automation/QUEUE_AUTO';
const QUEUE_AUTO_SUCCESS = 'wr/automation/QUEUE_AUTO_SUCCESS';
const QUEUE_AUTO_FAIL = 'wr/automation/QUEUE_AUTO_FAIL';

const TOGGLE_AUTOMATION = 'wr/automation/TOGGLE_AUTOMATION';
const TOGGLE_AUTOMATION_SUCCESS = 'wr/automation/TOGGLE_AUTOMATION_SUCCESS';
const TOGGLE_AUTOMATION_FAIL = 'wr/automation/TOGGLE_AUTOMATION_FAIL';

const TOGGLE_AUTOPILOT_SIDEBAR = 'wr/automation/TOGGLE_AUTOPILOT_SIDEBAR';

const TOGGLE_MODAL = 'wr/automation/TOGGLE_MODAL';


const initialState = fromJS({
  autoId: null,
  active: false,
  behavior: null,
  behaviorMessages: List(),
  behaviorStats: Map(),
  autopilot: false,
  autopilotReady: false,
  autopilotStatus: 'new', // new, running, stopping, stopped, complete
  autopilotUrl: '',
  autopilotInfo: List(),
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
    case AUTOPILOT_CHECK_SUCCESS:
      return state.set('autopilotInfo', fromJS(action.result.behaviors));
    case AUTOPILOT_TOGGLE_AUTOMATION:
      return state.merge({
        behavior: action.behavior,
        autopilotStatus: action.status,
        autopilotUrl: action.url
      });
    case AUTOPILOT_UPDATE_BEHAVIOR_STATUS:
      return state.merge({
        behaviorStats: fromJS(action.behaviorState.state),
        behaviorMessages: state.get('behaviorMessages').push(Map({ msg: action.behaviorState.msg }))
      });
    case AUTOPILOT_UPDATE_BEHAVIOR_MESSAGE:
      return state.set('behaviorMessages', state.get('behaviorMessages').push(Map({ msg: action.msg })));
    case TOGGLE_AUTOPILOT_SIDEBAR:
      return state.set('autopilot', action.bool);
    case AUTOPILOT_READY:
      return state.set('autopilotReady', true);
    case AUTOPILOT_RESET:
      return state.merge({
        autopilotStatus: 'new',
        autopilotReady: false,
        autopilotInfo: List(),
        autopilotUrl: action.url,
        behavior: null,
        behaviorMessages: List(),
        behaviorStats: Map()
      });
    default:
      return state;
  }
}


export function autopilotCheck(url = '') {
  return {
    types: [AUTOPILOT_CHECK, AUTOPILOT_CHECK_SUCCESS, AUTOPILOT_CHECK_FAIL],
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


export function autopilotReady() {
  return {
    type: AUTOPILOT_READY
  };
}


export function autopilotReset(url = '') {
  return {
    type: AUTOPILOT_RESET,
    url
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


export function toggleAutopilotSidebar(bool) {
  return {
    type: TOGGLE_AUTOPILOT_SIDEBAR,
    bool
  };
}


export function toggleAutopilot(behavior, status, url = '') {
  return {
    type: AUTOPILOT_TOGGLE_AUTOMATION,
    behavior,
    status,
    url
  };
}

export function updateBehaviorState(behaviorState) {
  return {
    type: AUTOPILOT_UPDATE_BEHAVIOR_STATUS,
    behaviorState,
  };
}


export function updateBehaviorMessage(msg) {
  return {
    type: AUTOPILOT_UPDATE_BEHAVIOR_MESSAGE,
    msg
  };
}


export function toggleModal(bool) {
  return {
    type: TOGGLE_MODAL,
    bool
  };
}
