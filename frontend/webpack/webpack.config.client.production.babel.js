import merge from 'webpack-merge';
import path from 'path';
import webpack from 'webpack';

import CleanPlugin from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import UglifyJsPlugin from 'uglifyjs-webpack-plugin';

import getBaseConfig from './webpack.config.client';

const projectRootPath = path.resolve(__dirname, '../');
const assetsPath = path.resolve(projectRootPath, './static/dist');
const baseConfig = getBaseConfig({ development: false });

const prodConfig = {
  devtool: 'source-map',

  entry: {
    main: [
      './config/polyfills',
      'bootstrap-loader/extractStyles',
      './src/client.js'
    ]
  },

  plugins: [
    new CleanPlugin([assetsPath], { root: projectRootPath }),

    new CopyWebpackPlugin([
      {from: 'src/shared/novnc', to: 'novnc/'},
      'src/shared/images/favicon.png',
      'src/shared/images/webrecorder-social.png'
    ]),

    new ExtractTextPlugin({
      filename: '[name]-[chunkhash].css',
      allChunks: true
    }),

    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false,
      __PLAYER__: false
    }),

    // optimizations
    new UglifyJsPlugin({
      parallel: true,
      uglifyOptions: {
        compress: {
          unused: true,
          warnings: false,
          dead_code: true,
          drop_console: true
        }
      }
    })
  ]
};

export default merge(baseConfig, prodConfig);
