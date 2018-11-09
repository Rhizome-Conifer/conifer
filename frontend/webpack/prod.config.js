/* eslint-disable */
require('babel-polyfill');

// Webpack config for creating the production bundle.
var autoprefixer = require('autoprefixer');
var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var CleanPlugin = require('clean-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var UglifyJsPlugin = require('uglifyjs-webpack-plugin');
var strip = require('strip-loader');

var projectRootPath = path.resolve(__dirname, '../');
var assetsPath = path.resolve(projectRootPath, './static/dist');

// https://github.com/halt-hammerzeit/webpack-isomorphic-tools
var WebpackIsomorphicToolsPlugin = require('webpack-isomorphic-tools/plugin');
var webpackIsomorphicToolsPlugin = new WebpackIsomorphicToolsPlugin(require('./webpack-isomorphic-tools'));
var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');


module.exports = {
  devtool: 'source-map',
  context: path.resolve(__dirname, '..'),
  entry: {
    main: [
      './config/polyfills',
      'bootstrap-loader/extractStyles',
      './src/client.js'
    ]
  },
  output: {
    path: assetsPath,
    filename: '[name]-[chunkhash].js',
    chunkFilename: '[name]-[chunkhash].js',
    publicPath: '/static/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)?$/,
        exclude: /node_modules(\/|\\)(?!(react-rte))/,
        use: [
          strip.loader('debug'),
          'babel-loader'
        ]
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
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
              'sass-loader',
            ]
          })
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
    new CleanPlugin([assetsPath], { root: projectRootPath }),

    // css files from the extract-text-plugin loader
    new ExtractTextPlugin({
      filename: '[name]-[chunkhash].css',
      allChunks: true
    }),

    new webpack.EnvironmentPlugin({
      'ANNOUNCE_MAILING_LIST': null,
      'ALLOW_DAT': true,
      'APP_HOST': 'localhost:8089',
      'CONTENT_HOST': 'localhost:8092',
      'FRONTEND_PORT': 8095,
      'NODE_ENV': 'production',
      'SCHEME': 'http',
    }),

    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false,
      __PLAYER__: false
    }),

    // ignore dev config
    new webpack.IgnorePlugin(/\.\/dev/, /\/config$/),

    //new HardSourceWebpackPlugin(),

    // optimizations
    new UglifyJsPlugin({
      cache: true,
      parallel: true,
      sourceMap: true,
      uglifyOptions: {
        compress: {
          warnings: true
        }
      }
    }),

    webpackIsomorphicToolsPlugin
  ]
};
