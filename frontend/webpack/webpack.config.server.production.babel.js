import merge from 'webpack-merge';
import webpack from 'webpack';

import baseConfiguration from './webpack.config.server';


const config = {

  plugins: [
    new webpack.DefinePlugin({
      __CLIENT__: false,
      __SERVER__: true,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false,
      __PLAYER__: false
    })
  ]
};

export default merge(baseConfiguration, config);
