import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';

import dashboard from 'containers/Dashboard/reducer';
import users from 'containers/UserList/reducer';
import user from 'containers/UserDetail/reducer';


export default combineReducers({
  dashboard,
  users,
  user,
  routing: routerReducer,
});
