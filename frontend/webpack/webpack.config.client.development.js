import autoprefixer from 'autoprefixer';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import fs from 'fs';
import merge from 'webpack-merge';
import webpack from 'webpack';

import config from '../src/config';
import getBaseConfig from './webpack.config.client';

const host = '127.0.0.1';
const port = Number(config.port) + 1;
const baseConfig = getBaseConfig({
  development: true,
  css_bundle: true
});


const devConfig = {
  entry: {
    main: [
      'react-hot-loader/patch',
      `webpack-hot-middleware/client?path=http://${host}:${port}/__webpack_hmr&quiet=true`,
      './config/polyfills',
      'bootstrap-loader/extractStyles',
      './src/client.js'
    ]
  },

  output: {
    publicPath: `http://${host}:${port}${baseConfig.output.publicPath}`
  },

  plugins: [
    new CopyWebpackPlugin([
      {from: 'src/shared/novnc', to: 'novnc/'},
      'src/shared/images/favicon.png',
      'src/shared/images/webrecorder-social.png'
    ]),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: true,
      __DEVTOOLS__: true,
      __PLAYER__: false
    })
  ]
};

export default merge(baseConfig, devConfig);
