import { isLoaded as isAuthLoaded, load as loadAuth } from 'redux/modules/auth';

import { FAQ, TermsAndPolicies } from 'components/siteComponents';
import {
  Application,
  CollectionList,
  CollectionDetail,
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


export default (store) => {
  const requireLogin = (nextState, replace, cb) => {
    function checkAuth() {
      const state = store.getState();
      if (!state.getIn(['auth', 'user', 'username'])) {
        // oops, not logged in, so can't be here!
        replace('/');
      }
      cb();
    }

    if (!isAuthLoaded(store.getState())) {
      store.dispatch(loadAuth()).then(checkAuth);
    } else {
      checkAuth();
    }
  };

  const userRoutes = [
    /* collection */
    {
      path: '/:user([^_]\w+)',
      name: 'collection',
      breadcrumb: true,
      footer: true,
      component: CollectionList,
    },
    {
      path: ':user/_settings',
      name: 'settings',
      footer: true,
      onEnter: requireLogin,
      component: UserSettings
    },
    {
      path: ':user/:coll(/:rec)',
      name: 'collectionDetail',
      breadcrumb: true,
      footer: true,
      component: CollectionDetail
    }
  ];

  const controllerRoutes = [
    /* TODO: add permissions check */
    {
      path: ':user/:coll/$new',
      name: 'new recording',
      footer: false,
      classOverride: true,
      component: NewRecording
    },
    {
      path: ':user/:coll/:rec/record/*',
      name: 'record',
      footer: false,
      classOverride: true,
      component: Record
    },
    {
      path: ':user/:coll/:rec/patch/*',
      name: 'patch',
      footer: false,
      classOverride: true,
      component: Patch
    },
    {
      path: ':user/:coll/:rec/extract:**/:ts/*',
      name: 'patch',
      footer: false,
      classOverride: true,
      component: Extract
    },
    {
      path: ':user/:coll/:rec/extract_only:**/:ts/*',
      name: 'patch',
      footer: false,
      classOverride: true,
      component: Extract
    },
    {
      path: ':user/:coll/:ts/*',
      name: 'replay',
      mode: 'replay',
      footer: false,
      classOverride: true,
      component: Replay
    }
  ];

  const infoRoutes = [
    {
      path: '_faq',
      name: 'FAQ',
      footer: true,
      component: FAQ
    },
    {
      path: '_policies',
      name: 'Terms & Policies',
      footer: true,
      component: TermsAndPolicies
    }
  ];

  const routes = [
    /* core */
    {
      path: '_register',
      name: 'registration',
      footer: true,
      component: UserSignup
    },
    {
      path: '_forgot',
      name: 'Password Reset',
      footer: true,
      component: PasswordReset
    },
    {
      path: '_logout',
      name: 'logout',
      footer: false,
      component: Logout,
    },

    ...infoRoutes,
    ...controllerRoutes,
    ...userRoutes,

    {
      path: '*',
      name: 'notfound',
      footer: true,
      component: HttpStatus
    }
  ];

  return {
    path: '/',
    component: Application,
    indexRoute: {
      component: Home,
      footer: true
    },
    childRoutes: routes
  };
};
