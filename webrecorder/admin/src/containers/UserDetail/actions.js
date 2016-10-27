import { LOAD_USER, LOAD_USER_SUCCESS, UPDATE_USER, UPDATE_USER_SUCCESS } from './constants';


export function loadUser(username) {
  return {
    type: LOAD_USER,
    username,
  };
}

export function userLoaded(user) {
  return {
    type: LOAD_USER_SUCCESS,
    user,
  };
}

export function updateUser(username, data) {
  return {
    type: UPDATE_USER,
    username,
    data,
  };
}

export function userUpdated(user) {
  return {
    type: UPDATE_USER_SUCCESS,
    user,
  };
}
