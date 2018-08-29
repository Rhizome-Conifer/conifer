/* eslint-disable */
var Express = require('express');
var webpack = require('webpack');

var webpackConfig = require('./dev.config');
var compiler = webpack(webpackConfig);

const host = process.env.APP_HOST || '127.0.0.1';
const port = (Number(process.env.FRONTEND_PORT) + 1) || 8096;

var serverOptions = {
  contentBase: 'http://' + host + ':' + port,
  quiet: true,
  noInfo: true,
  hot: true,
  inline: true,
  lazy: false,
  publicPath: webpackConfig.output.publicPath,
  headers: {'Access-Control-Allow-Origin': '*'},
  stats: {colors: true}
};

var app = new Express();

app.use(require('webpack-dev-middleware')(compiler, serverOptions));
app.use(require('webpack-hot-middleware')(compiler));

app.listen(port, function onAppListening(err) {
  if (err) {
    console.error(err);
  } else {
    console.info('==> 🚧  Webpack development server listening on port %s', port);
  }
});
