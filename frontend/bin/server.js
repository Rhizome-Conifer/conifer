#!/usr/bin/env node
require('@babel/register')({
  only: [/node_modules(\/|\\)react-rte/]
});

// ignore css imports within react-rte
require.extensions['.css'] = () => {};

const server = require('universal-webpack/server');
const settings = require('../webpack/universal-webpack-settings');
const wpConfig = require('../webpack/webpack.config');


/**
 * Define isomorphic constants.
 */
global.__CLIENT__ = false;
global.__SERVER__ = true;
global.__DISABLE_SSR__ = process.env.DISABLE_SSR ? process.env.DISABLE_SSR === 'true' : false;
global.__PLAYER__ = false;
global.__DEVELOPMENT__ = process.env.NODE_ENV !== 'production';

server(wpConfig, settings);
