import { isLoaded as isAuthLoaded, load as loadAuth } from 'redux/modules/auth';


import FAQ from 'components/FAQ';
import { Application, CollectionList, CollectionDetail, Home, HttpStatus,
         UserSettings } from 'containers';


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
      component: CollectionList,
    },
    {
      path: ':user/_settings',
      name: 'settings',
      onEnter: requireLogin,
      component: UserSettings
    },
    {
      path: ':user/:coll',
      name: 'collectionDetail',
      breadcrumb: true,
      component: CollectionDetail
    }
  ];

  const infoRoutes = [
    {
      path: '_faq',
      name: 'FAQ',
      component: FAQ
    },
    {
      path: '_policies',
      name: 'Terms & Policies',
      component: HttpStatus
    }
  ];

  const routes = [
    /* core */
    {
      path: '_register',
      name: 'registration',
      component: HttpStatus
    },

    ...infoRoutes,
    ...userRoutes,

    {
      path: '*',
      name: 'notfound',
      component: HttpStatus
    }
  ];

  return {
    path: '/',
    component: Application,
    indexRoute: { component: Home },
    childRoutes: routes
  };
};
