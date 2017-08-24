import { fromJS } from 'immutable';

const REPORT = 'wr/bugReport/REPORT';
const REPORT_SUCCESS = 'wr/bugReport/REPORT_SUCCESS';
const REPORT_FAIL = 'wr/bugReport/REPORT_FAIL';

const initialState = fromJS({
  submitting: false,
  submitted: false,
  error: null
});

export default function bugReport(state = initialState, action = {}) {
  switch (action.type) {
    case REPORT:
      return state.merge({
        submitting: true,
        submitted: false
      });
    case REPORT_SUCCESS:
      return state.merge({
        submitting: false,
        sbumitted: true,
        error: null
      });
    case REPORT_FAIL:
      return state.merge({
        submitting: false,
        sbumitted: false,
        error: true
      });
    default:
      return state;
  }
}


export function reportBug(postData) {
  return {
    types: [REPORT, REPORT_SUCCESS, REPORT_FAIL],
    promise: client => client.post('/_reportissues', {
      data: {
        ...postData
      }
    })
  };
}
