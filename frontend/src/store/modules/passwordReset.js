import { fromJS } from 'immutable';

import { apiPath } from 'config';

const RESET = 'wr/passwordReset/RESET';
const RESET_SUCCESS = 'wr/passwordReset/RESET_SUCCESS';
const RESET_FAIL = 'wr/passwordReset/RESET_FAIL';

const SET = 'wr/passwordReset/SET';
const SET_SUCCESS = 'wr/passwordReset/SET_SUCCESS';
const SET_FAIL = 'wr/passwordReset/SET_FAIL';


const initialState = fromJS({
  errors: null,
  resest: false,
  setNew: false
});


export default function passwordReset(state = initialState, action = {}) {
  switch (action.type) {
    case RESET:
      return state.set('reset', false);
    case RESET_SUCCESS:
      return state.merge({
        reset: true,
        errors: null
      });
    case RESET_FAIL:
      return state.merge({
        reset: false,
        errors: fromJS(action.error)
      });
    case SET:
      return state.set('setNew', false);
    case SET_SUCCESS:
      return state.merge({
        setNew: true,
        errors: false
      });
    case SET_FAIL:
      return state.merge({
        setNew: false,
        errors: fromJS(action.error)
      });
    default:
      return state;
  }
}


export function resetPassword(postData) {
  return {
    types: [RESET, RESET_SUCCESS, RESET_FAIL],
    promise: client => client.post(`${apiPath}/auth/password/reset_request`, {
      data: {
        ...postData
      }
    })
  };
}


export function setNewPassword(postData) {
  return {
    types: [SET, SET_SUCCESS, SET_FAIL],
    promise: client => client.post(`${apiPath}/auth/password/reset`, {
      data: {
        ...postData
      }
    })
  };
}
