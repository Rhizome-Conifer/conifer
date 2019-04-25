import autoprefixer from 'autoprefixer';
import merge from 'webpack-merge';
import webpack from 'webpack';

import { port } from '../src/config';
import baseConfig from './webpack.config.server';

const host = process.env.APP_HOST || '127.0.0.1';
const assetPort = Number(port) + 1;

const config = {
  mode: 'development',
  output: {
    publicPath: `http://${host}:${assetPort}${baseConfig.output.publicPath}`
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'cache-loader',
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
            loader: 'css-loader'
          }
        ]
      }
    ]
  },

  plugins: [
    new webpack.DefinePlugin({
      __CLIENT__: false,
      __SERVER__: true,
      __DEVELOPMENT__: true,
      __DEVTOOLS__: true,
      __PLAYER__: false,
      __DESKTOP__: false
    }),
  ]
};

export default merge(baseConfig, config);
