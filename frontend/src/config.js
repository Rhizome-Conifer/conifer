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


// public IP (for WebRTC connection)
const publicIP = process.env.PUBLIC_IP ? process.env.PUBLIC_IP : appHost;


export default Object.assign({
  announceMailingList: process.env.ANNOUNCE_MAILING_LIST,
  apiProxy: false,
  apiPath: '/api/v1',
  appHost: `${hostScheme}://${appHost}`,
  contentHost: `${hostScheme}://${contentHost}`,
  publicIP: publicIP,
  columns: ['rowIndex', 'timestamp', 'title', 'url', 'browser', 'session'],
  columnLabels: {
    'browser': 'Capture Browser',
    'rowIndex': 'Index',
    'session': 'Session ID',
    'title': 'Page Title'
  },
  columnMappings: {
    'session': 'rec'
  },
  defaultBookmarkDesc: 'No description provided.',
  defaultCollectionTitle: 'New Collection',
  defaultColumns: ['rowIndex', 'timestamp', 'title', 'url', 'browser'],
  defaultCollDesc: '_This collection doesn\'t yet have a description._',
  defaultListDesc: '_This list doesn\'t yet have a description._',
  defaultRecDesc: 'Add notes about this session. Visible only to you.',
  defaultRecordingTitle: 'Recording Session',
  dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  draggableTypes: {
    LIST: 'list',
    BOOKMARK_ITEM: 'bookmarkItem',
    PAGE_ITEM: 'pageItem',
    TH: 'tableHeader'
  },
  guestSessionTimeout: '90mins',
  homepageAnnouncement: '',
  internalApiHost: process.env.INTERNAL_HOST,
  internalApiPort: process.env.INTERNAL_PORT,
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  passwordRegex: new RegExp(/(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}/),
  port: process.env.FRONTEND_PORT || 8095,
  product: 'Webrecorder',
  productLink: 'https://webrecorder.io',
  ravenConfig: null,
  saveDelay: 1000,
  storageKey: 'wr__',
  supportEmail: 'support@webrecorder.io',
  tagline: 'Create high-fidelity, interactive web archives of any web site you browse.',
  truncSentence: new RegExp(/([.!?])/),
  truncWord: new RegExp(/(\s)/),
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
        { property: 'og:description', content: 'Create high-fidelity, interactive web archives of any web site you browse.' },
        { property: 'og:image', content: `${hostScheme}://${appHost}/static/webrecorder-social.png`, width: '1200', height: '630' }
      ]
    }
  },

}, localSettings);
