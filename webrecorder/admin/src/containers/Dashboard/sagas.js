import { take, call, put, fork } from 'redux-saga/effects';

import { getDashboard } from 'utils/Api';

import { LOAD_DASHBOARD } from './constants';
import { dashboardLoaded } from './actions';


export function* getDashboardFromAPI(params) {
  const data = yield call(getDashboard, params);
  yield put(dashboardLoaded(data));
}

export function* loadDashboardWatcher() {
  while(true) {
    const { params } = yield take(LOAD_DASHBOARD);
    yield getDashboardFromAPI(params);
  }
}

// watcher manager
export function* dashboardData() {
  yield fork(loadDashboardWatcher);
}

export default [
  dashboardData,
];
