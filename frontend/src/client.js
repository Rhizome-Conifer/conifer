import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { is } from 'immutable';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';

import createStore from './redux/create';
import ApiClient from './helpers/ApiClient';
import baseRoute from './routes';
import Root from './root';

import './base.scss';


const client = new ApiClient();

const dest = document.getElementById('app');
window.wrAppContainer = dest;

// eslint-disable-next-line no-underscore-dangle
const store = createStore(browserHistory, client, window.__data);

const createSelectLocationState = () => {
  let prevRoutingState;
  let prevRoutingStateJS;

  return (state) => {
    const routingState = state.app.get('routing');

    if (!is(prevRoutingState, routingState)) {
      prevRoutingState = routingState;
      prevRoutingStateJS = routingState.toJS();
    }

    return prevRoutingStateJS;
  };
};

const history = syncHistoryWithStore(browserHistory, store, {
  selectLocationState: createSelectLocationState()
});

const renderApp = (renderProps) => {
  ReactDOM.hydrate(
    <AppContainer>
      <Provider store={store} key="provider">
        <Root {...{ store, history, ...renderProps }} />
      </Provider>
    </AppContainer>,
    dest
  );
};

// render app
renderApp({ routes: baseRoute(store), client });

if (module.hot) {
  module.hot.accept('./routes', () => {
    const nextRoutes = require('./routes');

    renderApp({ routes: nextRoutes(store), client });
  });
}
