import autoprefixer from 'autoprefixer';
import merge from 'webpack-merge';
import webpack from 'webpack';

import { port } from '../src/config';
import baseConfig from './webpack.config.server';

const host = '127.0.0.1';
const assetPort = Number(port) + 1;

const config = {
  output: {
    publicPath: `http://${host}:${assetPort}${baseConfig.output.publicPath}`
  },

  plugins: [
    new webpack.DefinePlugin({
      __CLIENT__: false,
      __SERVER__: true,
      __DEVELOPMENT__: true,
      __DEVTOOLS__: true,
      __PLAYER__: false
    }),
  ]
};

export default merge(baseConfig, config);
