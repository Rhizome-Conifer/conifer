import { isLoaded as isAuthLoaded, load as loadAuth } from 'redux/modules/auth';

import { FAQ, TermsAndPolicies } from 'components/SiteComponents';
import { Application, CollectionList, CollectionDetail, Home, HttpStatus,
         Replay, UserSettings } from 'containers';


export default (store) => {
  const requireLogin = (nextState, replace, cb) => {
    function checkAuth() {
      const { auth: { user } } = store.getState();
      if (!user.username) {
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
      path: ':user/:coll',
      name: 'collectionDetail',
      breadcrumb: true,
      footer: true,
      component: CollectionDetail
    },
    {
      path: ':user/:coll/:ts/*',
      name: 'replay',
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
      component: HttpStatus
    },

    ...infoRoutes,
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
