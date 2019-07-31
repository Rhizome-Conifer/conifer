/* eslint-disable */
require('@babel/polyfill');

// Webpack config for creating the production bundle.
var autoprefixer = require('autoprefixer');
var path = require('path');
var webpack = require('webpack');
var CleanPlugin = require('clean-webpack-plugin');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

var projectRootPath = path.resolve(__dirname, '../../../app/');
var assetsPath = path.resolve(projectRootPath, './static');

const sassLoaders = [
  {
    loader: MiniCssExtractPlugin.loader
  },
  {
    loader: 'css-loader'
  },
  {
    loader: 'postcss-loader',
    options: {
      plugins: () => {
        return [
          autoprefixer({
            browsers: [
              '>1%',
              'last 4 versions',
              'Firefox ESR',
              'not ie < 10',
            ]
          })
        ];
      }
    }
  },
  'sass-loader'
];

if (process.env.NODE_ENV === 'development') {
  // sassLoaders.push({loader: 'cache-loader'});
}


module.exports = {
  mode: process.env.NODE_ENV,
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval',
  context: path.resolve(__dirname, '..'),
  entry: {
    main: [
      './config/polyfills',
      'bootstrap-loader',
      './src/client.js'
    ]
  },

  output: {
    path: assetsPath,
    filename: '[name].js',
    chunkFilename: '[name]-[chunkhash].js',
    publicPath: ''
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)?$/,
        exclude: /node_modules(\/|\\)(?!(react-rte))/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true
            }
          }
        ]
      },
      {
        test: /\.scss$/,
        use: sassLoaders
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
          mimetype: "image/svg+xml"
        }
      },
      {
        test: /\.(png|jpg|jpeg|gif)$/,
        loader: 'url-loader'
      }
    ]
  },

  node: {
    fs: "empty"
  },

  resolve: {
    alias: {
      components: path.resolve(__dirname, '../src/components'),
      containers: path.resolve(__dirname, '../src/containers'),
      helpers: path.resolve(__dirname, '../src/helpers'),
      store: path.resolve(__dirname, '../src/store'),
      shared: path.resolve(__dirname, '../src/shared'),
      config: path.resolve(__dirname, '../src/config.js'),
      routes: path.resolve(__dirname, '../src/routes.js')
    },
    modules: [
      'node_modules',
      path.resolve(__dirname, '../src'),
    ],
    extensions: ['.json', '.js']
  },

  plugins: [
    new CopyWebpackPlugin([
      'src/shared/images/favicon.png',
      'src/shared/images/webrecorder-social.png',
    ]),
    new CleanPlugin([assetsPath], { root: projectRootPath }),

    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "[id].css"
    }),

    new webpack.EnvironmentPlugin({
      'ANNOUNCE_MAILING_LIST': null,
      'ALLOW_DAT': true,
      'APP_HOST': 'localhost:8089',
      'CONTENT_HOST': 'localhost:8092',
      'FRONTEND_PORT': 8095,
      'SCHEME': 'http',
    }),

    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: true,
      __DEVTOOLS__: true,
      __PLAYER__: false,
      __DESKTOP__: true,
    })
  ]
};
