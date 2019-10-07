import autoprefixer from 'autoprefixer';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import fs from 'fs';
import merge from 'webpack-merge';
import webpack from 'webpack';

import config from '../src/config';
import getBaseConfig from './webpack.config.client';

const host = process.env.APP_HOST || '127.0.0.1';
const port = Number(config.port) + 1;
const baseConfig = getBaseConfig({
  development: true,
  useMiniCssExtractPlugin: false
});


const devConfig = {
  mode: 'development',
  entry: {
    main: [
      `webpack-hot-middleware/client?path=http://${host}:${port}/__webpack_hmr&quiet=true`,
      './config/polyfills',
      'bootstrap-loader',
      './src/client.js'
    ]
  },

  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.(js|jsx)?$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
        options: {
          cache: true,
          quiet: true
        }
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'cache-loader',
          },
          {
            loader: 'style-loader'
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
        ]
      },
      {
        test: /\.css$/,
        include: /node_modules\/react-rte/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              modules: true
            }
          }
        ]
      },
      {
        test: /\.css$/,
        exclude: /node_modules\/react-rte/,
        use: [
          {
            loader: 'cache-loader',
          },
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          }
        ]
      }
    ]
  },

  output: {
    publicPath: `http://${host}:${port}${baseConfig.output.publicPath}`
  },

  plugins: [
    new CopyWebpackPlugin([
      'src/shared/images/favicon.png',
      'src/shared/images/webrecorder-social.png'
    ]),
    new CircularDependencyPlugin({
      exclude: /node_modules/,
      failOnError: true,
      cwd: process.cwd()
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: true,
      __DEVTOOLS__: true,
      __PLAYER__: false,
      __DESKTOP__: false,
      'process.env.NODE_ENV': JSON.stringify('development')
    })
  ]
};

export default merge(baseConfig, devConfig);
