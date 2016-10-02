import { LOAD_DASHBOARD, LOAD_DASHBOARD_SUCCESS } from './constants';


const defaultState = {
  loading: false,
  dashboard: null,
};

export default function dashboard(state = defaultState, action) {
  switch(action.type) {
    case LOAD_DASHBOARD:
      return { ...state, dashboard: null, loading: true };
    case LOAD_DASHBOARD_SUCCESS:
      return {
        ...state,
        users: action.users,
        loading: false,
      };
    default:
      return state;
  }
}
