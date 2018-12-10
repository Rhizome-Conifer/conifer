import express from 'express';
import React from 'react';
import { renderToString } from 'react-dom/server';
import compression from 'compression';
import http from 'http';
import { StaticRouter } from 'react-router';
import { parse as parseUrl } from 'url';

import { ReduxAsyncConnect, loadOnServer } from 'redux-connect';
import { Provider } from 'react-redux';

import ApiClient from './helpers/ApiClient';
import config from './config';
import createStore from './store/create';
import baseRoute from './baseRoute';
import BaseHtml from './helpers/BaseHtml';

import './base.scss';


export default function (parameters) {
  const app = new express();
  const server = new http.Server(app);

  app.use((req, res) => {
    const client = new ApiClient(req, res);
    const store = createStore(client);
    const url = req.originalUrl || req.url;
    const location = parseUrl(url);

    if (!__DEVELOPMENT__) {
      app.use(compression());
    }

    if (__DISABLE_SSR__) {
      res.send(`<!doctype html>\n
        ${renderToString(<BaseHtml assets={parameters && parameters.chunks()} store={store} />)}`);

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

      const outputHtml = renderToString(
        <BaseHtml
          assets={parameters && parameters.chunks()}
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

  return {
    server,
    app
  };
}
