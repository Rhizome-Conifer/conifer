import { isLoaded as isAuthLoaded, load as loadAuth } from 'redux/modules/auth';

import { FAQ, TermsAndPolicies } from 'components/siteComponents';
import {
  Application,
  CollectionDetail,
  CollectionList,
  Extract,
  Home,
  HttpStatus,
  Logout,
  NewRecording,
  PasswordReset,
  Patch,
  Record,
  Replay,
  UserSignup,
  UserSettings
} from 'containers';


// const requireLogin = (nextState, replace, cb) => {
//   function checkAuth() {
//     const { app } = store.getState();
//     if (!app.getIn(['auth', 'user', 'username'])) {
//       // oops, not logged in, so can't be here!
//       replace('/');
//     }
//     cb();
//   }

//   if (!isAuthLoaded(store.getState())) {
//     store.dispatch(loadAuth()).then(checkAuth);
//   } else {
//     checkAuth();
//   }
// };

const userPath = '/:user([^\^_/]+)';

const userRoutes = [
  /* collection */
  {
    path: userPath,
    component: CollectionList,
    exact: true,
    name: 'collection',
    breadcrumb: true,
    footer: true
  },
  { /* TODO: add auth check */
    path: `${userPath}/_settings`,
    component: UserSettings,
    exact: true,
    name: 'settings',
    footer: true
  },
  {
    path: `${userPath}/:coll`,
    component: CollectionDetail,
    exact: true,
    name: 'collectionDetail',
    breadcrumb: true,
    footer: false,
    classOverride: true
  }
];

const controllerRoutes = [
  /* TODO: add permissions check */
  {
    path: `${userPath}/:coll/$new`,
    name: 'new recording',
    footer: false,
    classOverride: true,
    component: NewRecording,
    exact: true
  },
  {
    // record with remote browser id
    path: `${userPath}/:coll/:rec/record/$br::br/:splat(.*)`,
    name: 'record',
    footer: false,
    classOverride: true,
    component: Record,
    exact: true
  },
  {
    path: `${userPath}/:coll/:rec/record/:splat(.*)`,
    name: 'record',
    footer: false,
    classOverride: true,
    component: Record,
    exact: true
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts/:splat(.*)`,
    name: 'patch',
    footer: false,
    classOverride: true,
    component: Patch,
    exact: true
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode::archiveId(::collId)/:ts/:splat(.*)`,
    name: 'extract',
    footer: false,
    classOverride: true,
    component: Extract,
    exact: true
  },
  {
    path: `${userPath}/:coll/:ts/:splat(.*)`,
    name: 'replay',
    footer: false,
    classOverride: true,
    component: Replay,
    exact: true
  }
];

const infoRoutes = [
  {
    path: '/_faq',
    name: 'FAQ',
    footer: true,
    component: FAQ,
    exact: true
  },
  {
    path: '/_policies',
    name: 'Terms & Policies',
    footer: true,
    component: TermsAndPolicies,
    exact: true
  }
];

const routes = [
  /* core */
  {
    path: '/',
    component: Home,
    footer: true,
    exact: true
  },
  {
    path: '/_register',
    name: 'registration',
    footer: true,
    component: UserSignup,
    exact: true
  },
  {
    path: '/_forgot',
    name: 'Password Reset',
    footer: true,
    component: PasswordReset,
    exact: true
  },
  {
    path: '/_logout',
    name: 'logout',
    footer: false,
    component: Logout,
    exact: true
  },

  ...infoRoutes,
  ...controllerRoutes,
  ...userRoutes,

  {
    path: '*',
    name: 'notfound',
    footer: true,
    component: HttpStatus,
    exact: true
  }
];

export default [
  {
    component: Application,
    routes
  }
];
