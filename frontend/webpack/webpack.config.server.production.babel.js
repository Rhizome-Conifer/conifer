import autoprefixer from 'autoprefixer';
import merge from 'webpack-merge';
import webpack from 'webpack';

import baseConfiguration from './webpack.config.server';


const config = {
  mode: 'production',

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
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
            loader: 'css-loader'
          }
        ]
      },
    ]
  },

  plugins: [
    new webpack.DefinePlugin({
      __CLIENT__: false,
      __SERVER__: true,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false,
      __PLAYER__: false,
      __DESKTOP__: false,
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
};

export default merge(baseConfiguration, config);
