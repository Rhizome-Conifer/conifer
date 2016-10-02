// Needed for redux-saga es6 generator support
import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import useScroll from 'react-router-scroll/lib/useScroll';
import { applyRouterMiddleware, Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
import { Provider } from 'react-redux';

import App from 'containers/App';
import Dashboard from 'containers/Dashboard';

import routes from './routes';
import sagas from './sagas';
import store from './store';
import './base.scss';


// create the redux store, with dev-tools ext
const history = syncHistoryWithStore(browserHistory, store);

// wire up routing
const baseRoute = {
  path: '/admin',
  component: App,
  indexRoute: { component: Dashboard },
  childRoutes: routes,
};

// connect sagas
sagas.map(store.runSaga);

ReactDOM.render(
  <Provider store={store}>
    <Router
      history={history}
      routes={baseRoute}
      render={applyRouterMiddleware(useScroll())}
    />
  </Provider>,
  document.getElementById('root')
);
