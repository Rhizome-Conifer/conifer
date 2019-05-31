import { apiPath } from 'config';
import { fromJS } from 'immutable';


const NEW_AUTO = 'wr/automation/NEW_AUTO';
const NEW_AUTO_SUCCESS = 'wr/automation/NEW_AUTO_SUCCESS';
const NEW_AUTO_FAIL = 'wr/automation/NEW_AUTO_FAIL';

const QUEUE_AUTO = 'wr/automation/QUEUE_AUTO';
const QUEUE_AUTO_SUCCESS = 'wr/automation/QUEUE_AUTO_SUCCESS';
const QUEUE_AUTO_FAIL = 'wr/automation/QUEUE_AUTO_FAIL';

const TOGGLE_AUTOMATION = 'wr/automation/TOGGLE_AUTOMATION';
const TOGGLE_AUTOMATION_SUCCESS = 'wr/automation/TOGGLE_AUTOMATION_SUCCESS';
const TOGGLE_AUTOMATION_FAIL = 'wr/automation/TOGGLE_AUTOMATION_FAIL';

const TOGGLE_INPAGE_AUTOMATION = 'wr/automation/TOGGLE_INPAGE_AUTOMATION';

const TOGGLE_MODAL = 'wr/automation/TOGGLE_MODAL';


const initialState = fromJS({
  autoId: null,
  active: false,
  inpageAutomation: false,
  inpageRunning: false,
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
    case TOGGLE_INPAGE_AUTOMATION:
      return state.set('inpageAutomation', action.bool);
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


export function toggleInpageSidebar(bool) {
  return {
    type: TOGGLE_INPAGE_AUTOMATION,
    bool
  };
}
