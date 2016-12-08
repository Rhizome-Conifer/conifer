import { LOAD_SETTINGS, LOAD_SETTINGS_SUCCESS, UPDATE_SETTINGS,
         UPDATE_SETTINGS_SUCCESS } from './constants';


const defaultState = {
  settings: null,
  loading: false,
};

export default function settings(state = defaultState, action) {
  switch(action.type) {
    case LOAD_SETTINGS:
      return { ...state, settings: null, loading: true };
    case LOAD_SETTINGS_SUCCESS:
      return {
        ...state,
        settings: action.data,
        loading: false,
      };
    case UPDATE_SETTINGS:
      return { ...state, loading: true };
    case UPDATE_SETTINGS_SUCCESS:
      return { ...state, settings: action.data, loading: false };
    default:
      return state;
  }
}
