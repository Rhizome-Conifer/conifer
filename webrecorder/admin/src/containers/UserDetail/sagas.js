import { take, call, put, fork } from 'redux-saga/effects';

import { getUser, getUserRoles, setCollectionVisibility, updateUser } from 'utils/Api';

import { LOAD_USER, UPDATE_USER } from './constants';
import { userLoaded, userUpdated } from './actions';


export function* getUserFromAPI(username) {
  const user = yield call(getUser, username);
  // get the user roles available
  const roles = yield call(getUserRoles);

  yield put(userLoaded(user, roles));
}

export function* updateUserAPI(username, data) {
  const user = yield call(updateUser, username, data);
  yield put(userUpdated(user));
}

export function* updateCollectionVisbility(username, data) {
  const success = yield call(setCollectionVisibility, username, data.set_private, false);

  /**
   * for now we're using the pre-existing api method for setting collections private,
   * which doesn't return user data.. so on success retreive new user data.
   *
   * TODO: reevaluate, perhaps merging locally instead of requiring new data
   */
  if(success)
    yield getUserFromAPI(username);
}


export function* loadUserWatcher() {
  while(true) {
    const { username } = yield take(LOAD_USER);
    yield getUserFromAPI(username);
  }
}

export function* updateUserWatcher() {
  while(true) {
    const { username, data } = yield take(UPDATE_USER);
    // intercept collection changes and send to the proper api endpoint
    if(typeof data.set_private !== 'undefined')
      yield updateCollectionVisbility(username, data);
    else
      yield updateUserAPI(username, data);
  }
}

// watcher manager
export function* userGetter() {
  yield fork(loadUserWatcher);
}

export function* userPutter() {
  yield fork(updateUserWatcher);
}

export default [
  userGetter,
  userPutter,
];

