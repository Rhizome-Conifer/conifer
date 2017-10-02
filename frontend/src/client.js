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
    const routingState = state.get('routing');

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

const renderApp = (renderProps, includeDevTools = false) => {
  let DevTools;

  if(includeDevTools)
    DevTools = require('./containers/DevTools/DevTools');

  ReactDOM.hydrate(
    <AppContainer>
      <Provider store={store} key="provider">
        {
          includeDevTools ?
            <div>
              <Root {...{ store, history, ...renderProps }} />
              <DevTools />
            </div> :
            <Root {...{ store, history, ...renderProps }} />
        }
      </Provider>
    </AppContainer>,
    dest
  );
};

// render app, conditionally with dev tools
// eslint-disable-next-line
renderApp({ routes: baseRoute(store), client }, (__DEVTOOLS__ && !window.__REDUX_DEVTOOLS_EXTENSION__));

if (module.hot) {
  module.hot.accept('./routes', () => {
    const nextRoutes = require('./routes');

    renderApp({ routes: nextRoutes(store), client }, true);
  });
}
