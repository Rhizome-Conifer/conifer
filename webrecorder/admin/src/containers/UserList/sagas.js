import { take, call, put, fork } from 'redux-saga/effects';

import { getTempUsers, getUsers } from 'utils/Api';

import { LOAD_TEMP_USERS, LOAD_USERS } from './constants';
import { usersLoaded } from './actions';


export function* getUsersFromAPI(params) {
  const users = yield call(getUsers, params);
  yield put(
    usersLoaded(users)
  );
}

export function* getTempUsersFromAPI() {
  const users = yield call(getTempUsers);
  yield put(
    usersLoaded(users)
  );
}

export function* loadUsersWatcher() {
  while(true) {
    const { params } = yield take(LOAD_USERS);
    yield getUsersFromAPI(params);
  }
}

export function* loadTempUsersWatcher() {
  while(true) {
    yield take(LOAD_TEMP_USERS);
    yield getTempUsersFromAPI();
  }
}

// watcher manager
export function* usersData() {
  yield fork(loadUsersWatcher);
}

export function* tempUsersData() {
  yield fork(loadTempUsersWatcher);
}

export default [
  tempUsersData,
  usersData,
];
