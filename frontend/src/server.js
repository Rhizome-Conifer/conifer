import express from 'express';
import React from 'react';
import ReactDOM from 'react-dom/server';
import compression from 'compression';
import http from 'http';
import proxy from 'http-proxy-middleware';
import path from 'path';
import { parse as parseUrl } from 'url';
import PrettyError from 'pretty-error';
import StaticRouter from 'react-router/StaticRouter';

import { ReduxAsyncConnect, loadOnServer } from 'redux-connect';
import { Provider } from 'react-redux';

import ApiClient from './helpers/ApiClient';
import config from './config';
import createStore from './redux/create';
import baseRoute from './baseRoute';
import BaseHtml from './helpers/BaseHtml';

import './base.scss';


const baseUrl = `http://${config.internalApiHost}:${config.internalApiPort}`;
const app = new express();
const pretty = new PrettyError();
const server = new http.Server(app);
const bypassUrls = [
  '/api',
  '/_(reportissues|set_session|clear_session|client_ws|websockify|message)',
  '/_new*',
  '/websockify'
];

// TODO: use nginx
app.use(express.static(path.join(__dirname, '..', 'static')));

// proxy api and other urls on localhost
if (__DEVELOPMENT__ || baseUrl.indexOf('localhost') !== -1 || config.apiProxy) {
  app.use('/shared', express.static(path.join(__dirname, 'shared')));

  // Proxy client API requets to server for now to avoid CORS
  app.use(bypassUrls, proxy({
    target: baseUrl,
    logLevel: 'debug',
    changeOrigin: true
  }));
}

app.use(compression());

// intercept favicon.ico
app.use('/favicon.ico', (req, res) => {
  res.status(404).send('Not Found');
});

app.use((req, res) => {
  if (__DEVELOPMENT__) {
    // Do not cache webpack stats: the script file would change since
    // hot module replacement is enabled in the development env
    webpackIsomorphicTools.refresh();
  }
  const client = new ApiClient(req);
  const store = createStore(client);
  const url = req.originalUrl || req.url;
  const location = parseUrl(url);

  function hydrateOnClient() {
    res.send(`<!doctype html>\n
      ${ReactDOM.renderToString(<BaseHtml assets={webpackIsomorphicTools.assets()} store={store} />)}`);
  }

  if (__DISABLE_SSR__) {
    hydrateOnClient();
    return;
  }

  loadOnServer({ store, location, routes: baseRoute }).then(() => {
    const context = {};

    const component = (
      <Provider store={store} key="provider">
        <StaticRouter location={location} context={context}>
          <ReduxAsyncConnect routes={baseRoute} />
        </StaticRouter>
      </Provider>
    );

    const outputHtml = ReactDOM.renderToString(
      <BaseHtml
        assets={webpackIsomorphicTools.assets()}
        component={component}
        store={store} />
    );

    res.status(context.status ? context.status : 200);

    global.navigator = { userAgent: req.headers['user-agent'] };

    res.send(`<!doctype html>\n ${outputHtml}`);
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
