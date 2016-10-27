import HttpStatus from 'containers/HttpStatus';
import UserDetail from 'containers/UserDetail';
import UserList from 'containers/UserList';


const routes = [
  {
    path: 'users',
    name: 'user-list',
    component: UserList,
  },
  {
    path: 'temp-users',
    name: 'temp-user-list',
    component: UserList,
    temp: true,
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
