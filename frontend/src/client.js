import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';

import createStore from './redux/create';
import ApiClient from './helpers/ApiClient';
import baseRoute from './routes';
import Root from './root';

import './base.scss';


const client = new ApiClient();

const dest = document.getElementById('app');
window.wrAppContainer = dest;

// eslint-disable-next-line no-underscore-dangle
const store = createStore(client, window.__data);


const renderApp = (renderProps) => {
  ReactDOM.hydrate(
    <AppContainer>
      <Provider store={store} key="provider">
        <Root {...{ store, ...renderProps }} />
      </Provider>
    </AppContainer>,
    dest
  );
};

// render app
renderApp({ routes: baseRoute, client });

if (module.hot) {
  module.hot.accept('./routes', () => {
    const nextRoutes = require('./routes');

    renderApp({ routes: nextRoutes, client });
  });
}
