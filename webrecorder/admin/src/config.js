/* eslint-disable */

/**
 * for local settings override, create `config.local.js` in the same directory
 * as this file..
 *
 * example contents:
 *
 * module.exports = {
 *   endpoint: 'http://a-whole-new-webrecorder.io/api/v3',
 *   debug: true,
 * };
 *
 */
let localSettings;

try {
  localSettings = require('./config.local');
} catch (e) {
  localSettings = {};
}

const settings = {
  endpoint: '/api/v1',
  actionKey: 'wr/',
  debug: false,
};

module.exports = Object.assign({}, settings, localSettings);
