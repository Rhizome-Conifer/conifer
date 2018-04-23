import { apiPath } from 'config';

const RECS_LOAD = 'wr/recordings/RECS_LOAD';
const RECS_LOAD_SUCCESS = 'wr/recordings/RECS_LOAD_SUCCESS';
const RECS_LOAD_FAIL = 'wr/recordings/RECS_LOAD_FAIL';

const REC_LOAD = 'wr/recordings/REC_LOAD';
const REC_LOAD_SUCCESS = 'wr/recordings/REC_LOAD_SUCCESS';
const REC_LOAD_FAIL = 'wr/recordings/REC_LOAD_FAIL';

const REC_EDIT = 'wr/rec/REC_EDIT';
const REC_EDIT_SUCCESS = 'wr/recordings/REC_EDIT_SUCCESS';
const REC_EDIT_FAIL = 'wr/recordings/REC_EDIT_FAIL';
const REC_EDITED_RESET = 'wr/recordings/REC_EDITED_RESET';

const REC_DELETE = 'wr/recordings/REC_DELETE';
const REC_DELETE_SUCCESS = 'wr/recordings/REC_DELETE_SUCCESS';
const REC_DELETE_FAIL = 'wr/recordings/REC_DELETE_FAIL';


const initialState = {
  edited: false,
  loaded: false
};


export default function recordings(state = initialState, action = {}) {
  switch (action.type) {
    case RECS_LOAD:
      return {
        ...state,
        loading: true
      };
    case RECS_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        recordings: action.result.recordings
      };
    case RECS_LOAD_FAIL:
      return {
        ...state,
        loading: false,
        loaded: false,
        error: action.error
      };
    case REC_EDIT_SUCCESS:
      return state.merge({
        edited: true,
        ...action.data
      });
    case REC_EDITED_RESET:
      return state.set('edited', false);
    case REC_LOAD:
      return {
        ...state,
        loading: true
      };
    case REC_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        recording: action.result.recording
      };
    case REC_LOAD_FAIL:
      return {
        ...state,
        loading: false,
        loaded: false,
        error: action.error
      };
    default:
      return state;
  }
}


export function collRecordings(user, coll) {
  return {
    types: [RECS_LOAD, RECS_LOAD_SUCCESS, RECS_LOAD_FAIL],
    promise: client => client.get(`${apiPath}/recordings`, {
      params: { user, coll }
    })
  };
}


export function loadRecording(user, coll, rec) {
  return {
    types: [REC_LOAD, REC_LOAD_SUCCESS, REC_LOAD_FAIL],
    promise: client => client.get(`${apiPath}/recording/${rec}`, {
      params: { user, coll }
    })
  };
}


export function edit(user, coll, rec, data) {
  return {
    types: [REC_EDIT, REC_EDIT_SUCCESS, REC_EDIT_FAIL],
    promise: client => client.post(`${apiPath}/recording/${rec}`, {
      params: { user, coll },
      data
    }),
    data
  };
}


export function resetEditState() {
  return { type: REC_EDITED_RESET };
}


export function deleteRecording(user, coll, rec) {
  return {
    types: [REC_DELETE, REC_DELETE_SUCCESS, REC_DELETE_FAIL],
    promise: client => client.del(`${apiPath}/recording/${rec}`, {
      params: { user, coll }
    })
  };
}
