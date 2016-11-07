import { take, call, put, fork } from 'redux-saga/effects';

import { getSettings, updateSettings } from 'utils/Api';

import { LOAD_SETTINGS, UPDATE_SETTINGS } from './constants';
import { settingsLoaded, settingsUpdated } from './actions';


export function* getSettingsFromAPI() {
  const settings = yield call(getSettings);
  yield put(settingsLoaded(settings));
}

export function* updateSettingsAPI(data) {
  const results = yield call(updateSettings, data);
  yield put(settingsUpdated(results));
}

export function* loadSettingsWatcher() {
  while(true) {
    yield take(LOAD_SETTINGS);
    yield getSettingsFromAPI();
  }
}

export function* updateSettingsWatcher() {
  while(true) {
    const { data } = yield take(UPDATE_SETTINGS);
    yield updateSettingsAPI(data);
  }
}

// watcher manager
export function* settingsGetter() {
  yield fork(loadSettingsWatcher);
}

export function* settingsPutter() {
  yield fork(updateSettingsWatcher);
}

export default [
  settingsGetter,
  settingsPutter,
];

