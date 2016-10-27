import { LOAD_TEMP_USERS, LOAD_USERS, LOAD_USERS_SUCCESS } from './constants';


const defaultState = {
  loading: false,
  users: [],
};

export default function users(state = defaultState, action) {
  switch(action.type) {
    case LOAD_USERS:
      return { ...state, loading: true };
    case LOAD_TEMP_USERS:
      return { ...state, loading: true };
    case LOAD_USERS_SUCCESS:
      return {
        ...state,
        loading: false,
        users: action.users,
      };
    default:
      return state;
  }
}
