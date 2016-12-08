import HttpStatus from 'containers/HttpStatus';
import UserDetail from 'containers/UserDetail';
import UserList from 'containers/UserList';
import Settings from 'containers/Settings';


const routes = [
  {
    path: 'settings',
    name: 'edit-settings',
    component: Settings,
  },
  {
    path: 'temp-users',
    name: 'temp-user-list',
    component: UserList,
    temp: true,
  },
  {
    path: 'users',
    name: 'user-list',
    component: UserList,
  },
  {
    path: 'users/:username',
    name: 'user-detail',
    component: UserDetail,
  },
  {
    path: '*',
    name: 'notfound',
    component: HttpStatus,
  },
];

export default routes;
