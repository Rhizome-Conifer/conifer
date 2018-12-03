import autoprefixer from 'autoprefixer';
import merge from 'webpack-merge';
import path from 'path';
import webpack from 'webpack';

import CleanPlugin from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

import getBaseConfig from './webpack.config.client';

const projectRootPath = path.resolve(__dirname, '../');
const assetsPath = path.resolve(projectRootPath, './static/dist');
const baseConfig = getBaseConfig({ development: false, useMiniCssExtractPlugin: true });


const prodConfig = {
  devtool: 'source-map',
  mode: 'production',
  entry: {
    main: [
      './config/polyfills',
      'bootstrap-loader',
      './src/client.js'
    ]
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
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
        ]
      },
      {
        test: /\.css$/,
        include: /node_modules\/react-rte/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
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
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader'
          }
        ]
      },
    ]
  },

  plugins: [
    new CleanPlugin([assetsPath], { root: projectRootPath }),

    new CopyWebpackPlugin([
      {from: 'src/shared/novnc', to: 'novnc/'},
      'src/shared/images/favicon.png',
      'src/shared/images/webrecorder-social.png'
    ]),

    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false,
      __PLAYER__: false,
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
};

export default merge(baseConfig, prodConfig);
