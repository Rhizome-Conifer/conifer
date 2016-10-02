import { take, call, put, fork } from 'redux-saga/effects';

import { getUsers } from 'utils/Api';

import { LOAD_USERS } from './constants';
import { usersLoaded } from './actions';


export function* getUsersFromAPI(params) {
  const users = yield call(getUsers, params);
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

// watcher manager
export function* usersData() {
  yield fork(loadUsersWatcher);
}

export default [
  usersData,
];
