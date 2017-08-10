const RESET = 'wr/passwordReset/RESET';
const RESET_SUCCESS = 'wr/passwordReset/RESET_SUCCESS';
const RESET_FAIL = 'wr/passwordReset/RESET_FAIL';


const initialState = {
  resest: false
};

export default function passwordReset(state = initialState, action = {}) {
  switch (action.type) {
    case RESET:
      return {
        reset: false
      };
    case RESET_SUCCESS:
      return {
        reset: true
      };
    case RESET_FAIL:
      return {
        reset: false,
        errors: action.result
      };
    default:
      return state;
  }
}


export function resetPassword(postData) {
  return {
    types: [RESET, RESET_SUCCESS, RESET_FAIL],
    promise: client => client.post('/_forgot', {
      data: {
        ...postData
      }
    })
  };
}
