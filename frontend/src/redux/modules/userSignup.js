import config from 'config';


const SIGNUP = 'wr/userSignup/SIGN';
const SIGNUP_SUCCESS = 'wr/userSignup/SIGNUP_SUCCESS';
const SIGNUP_FAIL = 'wr/userSignup/SIGNUP_FAIL';
const USERNAME_CHECK = 'wr/userSignup/USERNAME_CHECK';
const USERNAME_CHECK_SUCCESS = 'wr/userSignup/USERNAME_CHECK_SUCESS';
const USERNAME_CHECK_ERROR = 'wr/userSignup/USERNAME_CHECK_ERROR';

const initialState = {
  success: false,
  result: null,
  errors: null,
  userCheck: false
};

export default function userSignup(state = initialState, action = {}) {
  switch (action.type) {
    case SIGNUP:
      return {
        ...state,
        success: false
      };
    case SIGNUP_SUCCESS:
      return {
        ...state,
        success: action.result && 'success' in action.result,
        result: action.result.success,
        errors: action.result.errors
      };
    case SIGNUP_FAIL:
      return {
        ...state,
        success: false,
        errors: action.result.errors
      };
    case USERNAME_CHECK:
      return {
        ...state,
        userCheck: false,
        userCheckError: null
      };
    case USERNAME_CHECK_SUCCESS:
      return {
        ...state,
        userCheck: true,
        checkedUsername: action.username,
        available: action.result.available,
        userCheckError: null
      };
    case USERNAME_CHECK_ERROR:
      return {
        ...state,
        userCheckError: action.result
      };
    default:
      return state;
  }
}


export function checkUser(username) {
  return {
    types: [USERNAME_CHECK, USERNAME_CHECK_SUCCESS, USERNAME_CHECK_ERROR],
    username,
    promise: client => client.get(`${config.apiPath}/username_check?username=${username}`)
  };
}

export function sendSignup(postData) {
  return {
    types: [SIGNUP, SIGNUP_SUCCESS, SIGNUP_FAIL],
    promise: client => client.post(`${config.apiPath}/userreg`, {
      data: {
        ...postData
      }
    })
  };
}
