import express from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import webpackConfig from './webpack.config.client.development.mjs';


const compiler = webpack(webpackConfig);

const host = process.env.APP_HOST || '127.0.0.1';
const port = (Number(process.env.FRONTEND_PORT) + 1) || 8096;

const serverOptions = {
  headers: { 'Access-Control-Allow-Origin': '*' },
  serverSideRender: true,
  stats: { colors: true },
  publicPath: webpackConfig.output.publicPath,
};

const app = new express();

app.use(webpackDevMiddleware(compiler, serverOptions));
app.use(webpackHotMiddleware(compiler));

app.listen(port, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.info('==> 🚧  Webpack development server listening on port %s', port);
  }
});
