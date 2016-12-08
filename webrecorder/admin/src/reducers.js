import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';

import dashboard from 'containers/Dashboard/reducer';
import settings from 'containers/Settings/reducer';
import users from 'containers/UserList/reducer';
import user from 'containers/UserDetail/reducer';


export default combineReducers({
  dashboard,
  settings,
  users,
  user,
  routing: routerReducer,
});
