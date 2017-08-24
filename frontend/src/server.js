import Express from 'express';
import React from 'react';
import ReactDOM from 'react-dom/server';
import compression from 'compression';
import http from 'http';
import httpProxy from 'http-proxy';
import PrettyError from 'pretty-error';
import createHistory from 'react-router/lib/createMemoryHistory';
import { match } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
import { ReduxAsyncConnect, loadOnServer } from 'redux-connect';
import { Provider } from 'react-redux';

import ApiClient from './helpers/ApiClient';
import config from './config';
import createStore from './redux/create';
import baseRoute from './routes';
import BaseHtml from './helpers/BaseHtml';

import './base.scss';

const baseUrl = `http://${config.internalApiHost}:${config.internalApiPort}`;
const targetUrl = `${baseUrl}/api`;
const app = new Express();
const pretty = new PrettyError();
const server = new http.Server(app);
const proxy = httpProxy.createProxyServer();

// Proxy client API requets to server for now to avoid
// CORS during port 3000 development
app.use('/api', (req, res) => {
  console.log('proxying requset', req.url, 'to', targetUrl);
  proxy.web(req, res, { target: targetUrl });
});

app.use('/_reportissues', (req, res) => {
  const newReq = Object.assign(req, { url: '/_reportissues' });
  console.log('proxying requset', req.url, 'to', baseUrl);
  proxy.web(newReq, res, { target: baseUrl });
});

app.use(compression());

// intercept favicon.ico
app.use('/favicon.ico', (req, res) => {
  res.status(404).send('Not Found');
});

// app.use(Express.static(path.join(__dirname, '..', 'static')));

app.use((req, res) => {
  if (__DEVELOPMENT__) {
    // Do not cache webpack stats: the script file would change since
    // hot module replacement is enabled in the development env
    webpackIsomorphicTools.refresh();
  }
  const client = new ApiClient(req);
  const memoryHistory = createHistory(req.originalUrl);
  const store = createStore(memoryHistory, client);

  const createSelectLocationState = () => {
    let prevRoutingState;
    let prevRoutingStateJS;
    return (state) => {
      const routingState = state.get('routing'); // or state.routing
      if (typeof prevRoutingState === 'undefined' || prevRoutingState !== routingState) {
        prevRoutingState = routingState;
        prevRoutingStateJS = routingState.toJS();
      }
      return prevRoutingStateJS;
    };
  };

  const history = syncHistoryWithStore(memoryHistory, store, {
    selectLocationState: createSelectLocationState()
  });

  function hydrateOnClient() {
    res.send(`<!doctype html>\n
      ${ReactDOM.renderToString(<BaseHtml assets={webpackIsomorphicTools.assets()} store={store} />)}`);
  }

  if (__DISABLE_SSR__) {
    hydrateOnClient();
    return;
  }

  match({ history, routes: baseRoute(store), location: req.originalUrl }, (error, redirectLocation, renderProps) => {
    if (redirectLocation) {
      res.redirect(redirectLocation.pathname + redirectLocation.search);
    } else if (error) {
      console.error('ROUTER ERROR:', pretty.render(error));
      res.status(500);
      hydrateOnClient();
    } else if (renderProps) {
      loadOnServer({ ...renderProps, store }).then(() => {
        const component = (
          <Provider store={store} key="provider">
            <ReduxAsyncConnect {...renderProps} />
          </Provider>
        );

        res.status(200);

        global.navigator = { userAgent: req.headers['user-agent'] };

        res.send(`<!doctype html>\n
          ${ReactDOM.renderToString(<BaseHtml assets={webpackIsomorphicTools.assets()} component={component} store={store} />)}`); // eslint-disable-line max-len
      });
    } else {
      res.status(404).send('Not found');
    }
  });
});

if (config.port) {
  server.listen(config.port, (err) => {
    if (err) {
      console.error(err);
    }
    console.info('----\n==> ✅  %s is running, talking to API server on %s.', config.app.title, config.internalApiPort);
    console.info('==> 💻  Open http://%s:%s in a browser to view the app.', config.host, config.port);
  });
} else {
  console.error('==>     ERROR: No PORT environment variable has been specified');
}

process.on('unhandledRejection', (error) => {
  console.log('ERROR:', error);
});
