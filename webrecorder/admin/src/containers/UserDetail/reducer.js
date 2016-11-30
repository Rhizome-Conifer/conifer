import { LOAD_USER, LOAD_USER_SUCCESS, UPDATE_USER, UPDATE_USER_SUCCESS } from './constants';


const defaultState = {
  loading: false,
  user: null,
};

export default function user(state = defaultState, action) {
  switch(action.type) {
    case LOAD_USER:
      return { ...state, user: null, loading: true };
    case LOAD_USER_SUCCESS:
      return {
        ...state,
        user: action.user,
        roles: action.roles,
        loading: false,
      };
    case UPDATE_USER:
      return { ...state, loading: true };
    case UPDATE_USER_SUCCESS:
      return {...state, user: action.user, loading: false };
    default:
      return state;
  }
}