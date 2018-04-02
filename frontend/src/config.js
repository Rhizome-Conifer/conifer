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
 *   contentHost: 'http://localhost:3001',
 *   defaultRecordingTitle: 'Session',
 *   homepageAnnouncement: '<h5>This is a test!</h5>'
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
  apiPath: '/api/v1',
  appHost: `${hostScheme}://${appHost}`,
  contentHost: `${hostScheme}://${contentHost}`,
  columns: ['timestamp', 'title', 'url', 'browser', 'session'],
  columnMappings: {
    'session': 'recording'
  },
  defaultBookmarkDesc: 'No description provided.',
  defaultCollectionTitle: 'New Collection',
  defaultColumns: ['timestamp', 'title', 'url', 'browser'],
  defaultCollDesc: '*This collection doesn\'t yet have a description.*',
  defaultListDesc: '*This list doesn\'t yet have a description.*',
  defaultRecordingTitle: 'Recording Session',
  draggableTypes: {
    PAGE_ITEM: 'pageItem',
    TH: 'tableHeader'
  },
  homepageAnnouncement: '',
  internalApiHost: process.env.INTERNAL_HOST,
  internalApiPort: process.env.INTERNAL_PORT,
  passwordRegex: new RegExp(/(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}/),
  port: process.env.FRONTEND_PORT || 8095,
  product: 'Webrecorder',
  ravenConfig: null,
  storageKey: 'wrLocalData',
  untitledEntry: 'Untitled Document',
  userRegex: new RegExp(/[A-Za-z0-9][\w-]{2,15}/),
  app: {
    title: 'Webrecorder',
    head: {
      titleTemplate: 'Webrecorder | %s',
      meta: [
        { name: 'description', content: '' },
        { charset: 'utf-8' },
        { property: 'og:site_name', content: 'Webrecorder' },
        { property: 'og:locale', content: 'en_US' },
        { property: 'og:title', content: 'Webrecorder' },
        { property: 'og:description', content: 'Create high-fidelity, interactive web archives of any web site you browse.' }

      ]
    }
  },

}, localSettings);
