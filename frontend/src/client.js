import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
import { ReduxAsyncConnect } from 'redux-connect';
import useScroll from 'scroll-behavior/lib/useStandardScroll';

import createStore from './redux/create';
import ApiClient from './helpers/ApiClient';
import baseRoute from './routes';

import './base.scss';


const client = new ApiClient();
const browserHistoryScroll = useScroll(() => browserHistory)();
const dest = document.getElementById('app');
// eslint-disable-next-line no-underscore-dangle
const store = createStore(browserHistoryScroll, client, window.__data);
const history = syncHistoryWithStore(browserHistoryScroll, store);

const component = (
  <Router
    render={props =>
      <ReduxAsyncConnect
        {...props}
        helpers={{ client }}
        filter={item => !item.deferred}
      />
    }
    history={history}
    routes={baseRoute(store)} />
);

ReactDOM.render(
  <Provider store={store} key="provider">
    {component}
  </Provider>,
  dest
);

if (process.env.NODE_ENV !== 'production') {
  window.React = React; // enable debugger

  if (!dest || !dest.firstChild || !dest.firstChild.attributes || !dest.firstChild.attributes['data-react-checksum']) {
    console.error('Server-side React render was discarded. Make sure that your initial render does not contain any' +
      'client-side code.');
  }
}

if (__DEVTOOLS__ && !window.devToolsExtension) {
  // eslint-disable-next-line global-require
  const DevTools = require('./containers/DevTools/DevTools');

  ReactDOM.render(
    <Provider store={store} key="provider">
      <div>
        {component}
        <DevTools />
      </div>
    </Provider>,
    dest
  );
}
