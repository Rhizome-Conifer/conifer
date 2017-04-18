/* eslint-disable */


// Webpack config for creating the production bundle.
var autoprefixer = require('autoprefixer');
var path = require('path');
var webpack = require('webpack');
var CleanPlugin = require('clean-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var strip = require('strip-loader');

var projectRootPath = path.resolve(__dirname, '../');
var assetsPath = path.resolve(projectRootPath, './static/dist');

// https://github.com/halt-hammerzeit/webpack-isomorphic-tools
var WebpackIsomorphicToolsPlugin = require('webpack-isomorphic-tools/plugin');
var webpackIsomorphicToolsPlugin = new WebpackIsomorphicToolsPlugin(require('./webpack-isomorphic-tools'));

module.exports = {
  devtool: 'source-map',
  context: path.resolve(__dirname, '..'),
  entry: {
    main: [
      'babel-polyfill',
      //'bootstrap-sass!./src/utils/bootstrap.config.prod.js',
      './config/polyfills',
      './src/client.js'
    ]
  },
  output: {
    path: assetsPath,
    filename: '[name]-[chunkhash].js',
    chunkFilename: '[name]-[chunkhash].js',
    publicPath: '/dist/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)?$/,
        exclude: /node_modules/,
        loaders: [
          strip.loader('debug'), 'babel-loader'
        ]
      },
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract({
            fallback:'style-loader',
            use: [
              {
                loader:'css-loader',
                options: {
                  modules: true,
                  importLoaders:2,
                  sourceMap:true
                },
              },
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
                          'not ie < 9',
                        ]
                      })
                    ]
                  }
                }
              },
              {
                loader: 'sass-loader',
                options: {
                  outputStyle: 'expanded',
                  sourceMap: true,
                  sourceMapContents: true
                }
              }
            ]
          })
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
    new CleanPlugin([assetsPath], { root: projectRootPath }),

    // css files from the extract-text-plugin loader
    new ExtractTextPlugin({
      filename: '[name]-[chunkhash].css',
      allChunks: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"'
      },

      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false
    }),

    // ignore dev config
    new webpack.IgnorePlugin(/\.\/dev/, /\/config$/),

    // optimizations
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }),

    webpackIsomorphicToolsPlugin
  ]
};
