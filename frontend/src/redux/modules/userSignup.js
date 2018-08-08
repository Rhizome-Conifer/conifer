import { fromJS } from 'immutable';

import config from 'config';


const SIGNUP = 'wr/userSignup/SIGN';
const SIGNUP_SUCCESS = 'wr/userSignup/SIGNUP_SUCCESS';
const SIGNUP_FAIL = 'wr/userSignup/SIGNUP_FAIL';
const USERNAME_CHECK = 'wr/userSignup/USERNAME_CHECK';
const USERNAME_CHECK_SUCCESS = 'wr/userSignup/USERNAME_CHECK_SUCESS';
const USERNAME_CHECK_ERROR = 'wr/userSignup/USERNAME_CHECK_ERROR';

const initialState = fromJS({
  success: false,
  result: null,
  errors: null,
  userCheck: false
});


export default function userSignup(state = initialState, action = {}) {
  switch (action.type) {
    case SIGNUP:
      return state.set('success', false);
    case SIGNUP_SUCCESS:
      return state.merge({
        success: action.result && 'success' in action.result,
        result: action.result.success,
        errors: null
      });
    case SIGNUP_FAIL:
      return state.merge({
        success: false,
        errors: action.error.errors
      });
    case USERNAME_CHECK:
      return state.merge({
        userCheck: false
      });
    case USERNAME_CHECK_SUCCESS:
      return state.merge({
        available: action.result.success,
        checkedUsername: action.username,
        userCheck: true
      });
    case USERNAME_CHECK_ERROR:
      return state.merge({
        available: false,
        checkedUsername: action.username,
        userCheck: true
      });
    default:
      return state;
  }
}


export function checkUser(username) {
  return {
    types: [USERNAME_CHECK, USERNAME_CHECK_SUCCESS, USERNAME_CHECK_ERROR],
    username,
    promise: client => client.get(`${config.apiPath}/auth/check_username/${username}`)
  };
}

export function sendSignup(postData) {
  return {
    types: [SIGNUP, SIGNUP_SUCCESS, SIGNUP_FAIL],
    promise: client => client.post(`${config.apiPath}/auth/register`, {
      data: {
        ...postData
      }
    })
  };
}
