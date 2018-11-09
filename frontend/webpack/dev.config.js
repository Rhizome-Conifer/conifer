/* eslint-disable */

// Webpack config for development
var autoprefixer = require('autoprefixer');
var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var assetsPath = path.resolve(__dirname, '../static/dist');

const host = process.env.APP_HOST || '127.0.0.1';
const port = (Number(process.env.PORT) + 1) || 8096;

// https://github.com/halt-hammerzeit/webpack-isomorphic-tools
var WebpackIsomorphicToolsPlugin = require('webpack-isomorphic-tools/plugin');
var webpackIsomorphicToolsPlugin = new WebpackIsomorphicToolsPlugin(require('./webpack-isomorphic-tools'));
var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
var CircularDependencyPlugin = require('circular-dependency-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');


var webpackConfig = module.exports = {
  devtool: 'cheap-module-source-map',
  context: path.resolve(__dirname, '..'),
  entry: {
    'main': [
      'babel-polyfill',
      'react-hot-loader/patch',
      'webpack-hot-middleware/client?path=http://' + host + ':' + port + '/__webpack_hmr&quiet=true',
      './config/polyfills',
      'bootstrap-loader',
      './src/client.js',
    ]
  },
  output: {
    path: assetsPath,
    filename: '[name]-[hash].js',
    chunkFilename: '[name]-[chunkhash].js',
    publicPath: 'http://' + host + ':' + port + '/dist/'
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.(js|jsx)?$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
        options: {
          quiet: true
        }
      },
      {
        test: /\.(js|jsx)?$/,
        exclude: /node_modules(\/|\\)(?!(react-rte))/,
        use: 'babel-loader'
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              plugins: function (){
                return [
                  autoprefixer({
                    browsers: [
                      '>1%',
                      'last 4 versions',
                      'Firefox ESR',
                      'ie >= 10',
                    ]
                  })
                ]
              }
            }
          },
          'sass-loader'
        ]
      },
      {
        test: /\.css$/,
        include: /node_modules(\/|\\)react-rte/,
        use: ['style-loader', 'css-loader?modules']
      },
      {
        test: /\.css$/,
        exclude: /node_modules(\/|\\)react-rte/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader",
        options: {
          limit: 10000,
          mimetype: "application/font-woff"
        }
      },
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader",
        options: {
          limit: 10000,
          mimetype: "application/font-woff"
        }
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader",
        options: {
          limit: 10000,
          mimetype: "application/octet-stream"
        }
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        loader: "file-loader"
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url-loader",
        options: {
          limit: 10000,
          mimetype: "image/svg+xml"
        }
      },
      {
        test: webpackIsomorphicToolsPlugin.regular_expression('images'),
        loader: "url-loader",
        options: {
          limit: 10240
        }
      }
    ]
  },
  resolve: {
    modules: [
      'src',
      'node_modules'
    ],
    extensions: ['.json', '.js']
  },
  plugins: [
    new CopyWebpackPlugin([
      'src/shared/images/favicon.png',
      'src/shared/images/webrecorder-social.png'
    ]),
    // hot reload
    new webpack.HotModuleReplacementPlugin(),
    new webpack.IgnorePlugin(/webpack-stats\.json$/),
    //new HardSourceWebpackPlugin(),
    new webpack.EnvironmentPlugin({
      'ANNOUNCE_MAILING_LIST': null,
      'ALLOW_DAT': false,
      'APP_HOST': 'localhost:8089',
      'CONTENT_HOST': 'localhost:8092',
      'FRONTEND_PORT': 8095,
      'NODE_ENV': 'development',
      'SCHEME': 'http',
    }),
    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: true,
      __DEVTOOLS__: true,
      __PLAYER__: false
    }),
    // new CircularDependencyPlugin({
    //   // exclude detection of files based on a RegExp
    //   exclude: /node_modules/,
    //   // add errors to webpack instead of warnings
    //   failOnError: false,
    //   // set the current working directory for displaying module paths
    //   cwd: process.cwd(),
    // }),
    webpackIsomorphicToolsPlugin.development()
  ]
};
