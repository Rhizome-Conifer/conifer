import DashboardSagas from 'containers/Dashboard/sagas';
import SettingsSagas from 'containers/Settings/sagas';
import UserListSagas from 'containers/UserList/sagas';
import UserDetailSagas from 'containers/UserDetail/sagas';


export default [
  ...DashboardSagas,
  ...SettingsSagas,
  ...UserListSagas,
  ...UserDetailSagas,
];
