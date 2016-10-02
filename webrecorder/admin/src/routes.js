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
