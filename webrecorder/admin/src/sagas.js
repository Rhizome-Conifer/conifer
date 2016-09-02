import DashboardSagas from 'containers/Dashboard/sagas';
import UserListSagas from 'containers/UserList/sagas';
import UserDetailSagas from 'containers/UserDetail/sagas';


export default [
  ...DashboardSagas,
  ...UserListSagas,
  ...UserDetailSagas,
];
