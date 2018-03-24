/* eslint-disable */
require('babel-polyfill');

/**
 * For local settings override, create `config.local.js` in the same directory
 * as this file..
 *
 * example contents:
 *
 * module.exports = {
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

// custom app domain or localhost default port mapping
const appHost = process.env.APP_HOST ? process.env.APP_HOST : `localhost:8089`;

// customizable hosting scheme
const hostScheme = process.env.SCHEME ? process.env.SCHEME : 'http';

// custom content domain or localhost default port mapping
const contentHost = process.env.CONTENT_HOST ? process.env.CONTENT_HOST : `localhost:8092`;


module.exports = Object.assign({
  apiProxy: false,
  port: process.env.FRONTEND_PORT || 8095,
  appHost: `${hostScheme}://${appHost}`,
  contentHost: `${hostScheme}://${contentHost}`,
  apiPath: '/api/v1',
  internalApiHost: process.env.INTERNAL_HOST,
  internalApiPort: process.env.INTERNAL_PORT,
  product: 'Webrecorder',
  defaultRecordingTitle: 'Recording Session',
  defaultBookmarkDesc: 'No description provided.',
  defaultCollectionTitle: 'New Collection',
  defaultCollDesc: '*This collection doesn\'t yet have a description.*',
  defaultListDesc: '*This list doesn\'t yet have a description.*',
  storageKey: 'wrLocalData',
  userRegex: new RegExp(/[A-Za-z0-9][\w-]{2,15}/),
  passwordRegex: new RegExp(/(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}/),
  untitledEntry: 'Untitled Document',
  ravenConfig: null,
  draggableTypes: {
    PAGE_ITEM: 'pageItem'
  },
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

}, localSettings);
