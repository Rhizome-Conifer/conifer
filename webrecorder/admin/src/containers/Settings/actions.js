import { LOAD_SETTINGS, LOAD_SETTINGS_SUCCESS,
         UPDATE_SETTINGS, UPDATE_SETTINGS_SUCCESS } from './constants';


export function loadSettings() {
  return {
    type: LOAD_SETTINGS,
  };
}

export function settingsLoaded(settings) {
  return {
    type: LOAD_SETTINGS_SUCCESS,
    data: settings,
  };
}

export function updateSettings(data) {
  return {
    type: UPDATE_SETTINGS,
    data,
  };
}

export function settingsUpdated(settings) {
  return {
    type: UPDATE_SETTINGS_SUCCESS,
    data: settings,
  };
}
