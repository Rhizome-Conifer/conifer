import Raven from 'raven-js';
import createRavenMiddleware from 'raven-for-redux';
import config from 'config';
import { createStore as _createStore, applyMiddleware, compose } from 'redux';
import { fromJS } from 'immutable';
import { enableBatching } from 'redux-batched-actions';


import createMiddleware from './middleware/clientMiddleware';


export default function createStore(client, data) {
  const middleware = [createMiddleware(client)];

  if (config.ravenConfig && !__SERVER__) {
    middleware.push(createRavenMiddleware(Raven));
  }

  let finalCreateStore;
  if (__DEVELOPMENT__ && __CLIENT__ && __DEVTOOLS__) {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { persistState } = require('redux-devtools');

    const composeEnhancer = typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ :
      compose;

    finalCreateStore = composeEnhancer(
      applyMiddleware(...middleware),
      persistState(window.location.href.match(/[?&]debug_session=([^&]+)\b/))
    )(_createStore);
  } else {
    finalCreateStore = compose(
      applyMiddleware(...middleware),
    )(_createStore);
  }
  // eslint-disable-next-line global-require
  const reducer = require('./reducer');


  let finalData;
  if (data) {
    finalData = Object.assign(data, { app: fromJS(data.app) });
  }
  const store = finalCreateStore(enableBatching(reducer), finalData);

  if (__DEVELOPMENT__ && module.hot) {
    module.hot.accept('./reducer', () => {
      // eslint-disable-next-line global-require
      store.replaceReducer(require('./reducer'));
    });
  }

  return store;
}
