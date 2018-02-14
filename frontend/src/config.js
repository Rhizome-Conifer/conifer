/* eslint-disable */
require('babel-polyfill');

/**
 * For local settings override, create `config.local.js` in the same directory
 * as this file..
 *
 * example contents:
 *
 * module.exports = {
 *   apiEndpoint: 'http://localhost:8089',
 *   appHost: 'http://localhost:3000',
 *   contentHost: 'http://localhost:8089',
 *   defaultRecordingTitle: "Session"
 * };
 *
 */

let localSettings;
try {
  localSettings = require('./config.local');
} catch (e) {
  localSettings = {};
}

const frontendHost = process.env.FRONTEND_HOST ? process.env.FRONTEND_HOST : process.env.APP_HOST;

module.exports = Object.assign({
  apiProxy: true,
  port: frontendHost.split(':').length ? frontendHost.split(':')[1] : 8089,
  apiEndpoint: `http://${frontendHost}`,
  appHost: `http://${frontendHost}`,
  contentHost: `http://${process.env.CONTENT_HOST}`,
  apiPath: '/api/v1',
  internalApiHost: process.env.INTERNAL_HOST,
  internalApiPort: process.env.INTERNAL_PORT,
  product: 'Webrecorder',
  defaultRecordingTitle: 'Recording Session',
  defaultCollectionTitle: 'New Collection',
  storageKey: 'wrLocalData',
  userRegex: new RegExp(/[A-Za-z0-9][\w-]{2,15}/),
  passwordRegex: new RegExp(/(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}/),
  untitledEntry: 'Untitled Document',
  app: {
    title: 'Webrecorder',
    description: '',
    head: {
      titleTemplate: 'Webrecorder | %s',
      meta: [
        { name: 'description', content: '' },
        { charset: 'utf-8' },
        { property: 'og:site_name', content: 'Webrecorder' },
        // { property: 'og:image', content: '' },
        { property: 'og:locale', content: 'en_US' },
        { property: 'og:title', content: 'Webrecorder' },
        { property: 'og:description', content: '' }
        // { property: 'og:card', content: 'summary' },
        // { property: 'og:site', content: '' },
        // { property: 'og:creator', content: '' },
        // { property: 'og:image:width', content: '200' },
        // { property: 'og:image:height', content: '200' }
      ]
    }
  },

}, {}, localSettings);
