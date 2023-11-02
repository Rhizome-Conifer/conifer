import path from 'node:path';
import { merge } from 'webpack-merge';
import webpack from 'webpack';
import nodeExternals from 'webpack-node-externals';

import config from '../src/config.mjs';
import baseConfiguration from './webpack.config.mjs';

let host = process.env.APP_HOST || '127.0.0.1';
const assetPort = Number(config.port) + 1;

if (host.includes(':')) {
  host = host.split(':')[0];
}


// turn off asset emitting for server side build
baseConfiguration.module.rules = baseConfiguration.module.rules.map(rule => {
  if (rule.type && rule.type.startsWith('asset')) {
    return {
      ...rule,
      generator: {
        emit: false,
      }
    }
  }
  return rule;
});

const serverConfig = {
  mode: 'development',
  target: 'node',
  externalsPresets: { node: true },
  externals: [
    nodeExternals({
      allowlist: [
        /\.(?!(?:jsx?|json)$).{1,5}$/i,
        /react-rte/,
      ]
    })
  ],

  entry: {
    server: "./src/server.js",
  },
  output: {
    path: path.resolve(process.cwd(), 'static/server'),
    filename: '[name].js',
    chunkFilename: '[name].js',
    libraryTarget: 'commonjs2',
    pathinfo: true,
    clean: true,
    publicPath: `http://${host}:${assetPort}${baseConfiguration.output.publicPath}`
  },

  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader'
          },
          { loader: 'css-loader',
            options: {
              modules: {
                exportOnlyLocals: true,
              },
            },
          },
          'postcss-loader',
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
        use: ['css-loader']
      }
    ]
  },

  plugins: [
    new webpack.HotModuleReplacementPlugin(),
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

export default merge(baseConfiguration, serverConfig);
