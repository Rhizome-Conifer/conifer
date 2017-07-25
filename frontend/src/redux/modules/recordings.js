import config from 'config';

const REC_LOAD = 'wr/rec/LOAD';
const REC_LOAD_SUCCESS = 'wr/rec/LOAD_SUCCESS';
const REC_LOAD_FAIL = 'wr/rec/LOAD_FAIL';

const initialState = {
  loaded: false
};

export default function recordings(state = initialState, action = {}) {
  switch (action.type) {
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
        recordings: action.result.recordings
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

export function load(username, coll) {
  return {
    types: [REC_LOAD, REC_LOAD_SUCCESS, REC_LOAD_FAIL],
    promise: client => client.get(`${config.apiPath}/recordings?user=${username}&coll=${coll}`)
  };
}
