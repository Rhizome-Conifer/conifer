import express from 'express';
import React from 'react';
import ReactDOM from 'react-dom/server';
import compression from 'compression';
import http from 'http';
import path from 'path';
import StaticRouter from 'react-router/StaticRouter';
import { parse as parseUrl } from 'url';

import { ReduxAsyncConnect, loadOnServer } from 'redux-connect';
import { Provider } from 'react-redux';

import ApiClient from './helpers/ApiClient';
import config from './config';
import createStore from './redux/create';
import baseRoute from './baseRoute';
import BaseHtml from './helpers/BaseHtml';

import './base.scss';


const app = new express();
const server = new http.Server(app);

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
  const client = new ApiClient(req, res);
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

    global.navigator = { userAgent: req.headers['user-agent'] };

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

    if (context.url) {
      res.redirect(context.status || 301, context.url);
    } else {
      res.status(context.status || 200);
      res.send(`<!doctype html>\n ${outputHtml}`);
    }
  });
});

if (config.port) {
  server.listen(config.port, (err) => {
    if (err) {
      console.error(err);
    }
    console.info('----\n==> ✅  %s is running, talking to API server on %s.', config.app.title, config.internalApiPort);
    console.info('==> 💻  Open %s in a browser to view the app.', config.appHost);
  });
} else {
  console.error('==>     ERROR: No PORT environment variable has been specified');
}

process.on('uncaughtException', (error) => {
  console.log('ERROR:', error);
});

process.on('unhandledRejection', (error) => {
  console.log('ERROR:', error);
});
