const REPORT = 'wr/bugReport/REPORT';
const REPORT_SUCCESS = 'wr/bugReport/REPORT_SUCCESS';
const REPORT_FAIL = 'wr/bugReport/REPORT_FAIL';

const initialState = {
  submitting: false,
  submitted: false
};

export default function bugReport(state = initialState, action = {}) {
  switch (action.type) {
    case REPORT:
      return {
        submitting: true,
        submitted: false
      };
    case REPORT_SUCCESS:
      return {
        submitting: false,
        sbumitted: true
      };
    case REPORT_FAIL:
      return {
        submitting: false,
        sbumitted: false,
        error: true
      };
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
