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


let appHost = null;

let isDesktop = false;

try {
  isDesktop = __DESKTOP__;
} catch (e) {
  // ignore, if undefined, not desktop
}

if (isDesktop) {
  const remoteProcess = window.require('electron').remote.process;
  process.env.INTERNAL_HOST = remoteProcess.env.INTERNAL_HOST;
  process.env.INTERNAL_PORT = remoteProcess.env.INTERNAL_PORT;
  appHost = `localhost:` + remoteProcess.env.INTERNAL_PORT;
} else {

  // custom app domain or localhost default port mapping
  appHost = process.env.APP_HOST ? process.env.APP_HOST : `localhost:8089`;
}

// customizable hosting scheme
const hostScheme = process.env.SCHEME ? process.env.SCHEME : 'http';

// custom content domain or localhost default port mapping
const contentHost = process.env.CONTENT_HOST ? process.env.CONTENT_HOST : `localhost:8092`;


// public IP (for WebRTC connection)
const publicIP = process.env.PUBLIC_IP ? process.env.PUBLIC_IP : appHost;


export default Object.assign({
  anonDisabled: process.env.ANON_DISABLED,
  announceMailingList: process.env.ANNOUNCE_MAILING_LIST,
  apiProxy: false,
  apiPath: '/api/v1',
  appHost: `${hostScheme}://${appHost}`,
  contentHost: `${hostScheme}://${contentHost}`,
  publicIP: publicIP,
  columns: ['timestamp', 'title', 'url', 'browser', 'session'],
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
  defaultColumns: ['timestamp', 'title', 'url', 'browser'],
  defaultCollDesc: '_This collection doesn\'t yet have a description._',
  defaultListDesc: '_This list doesn\'t yet have a description._',
  defaultRecDesc: 'Add notes about this session. Visible only to you.',
  defaultRecordingTitle: 'Recording Session',
  defaultSort: { sort: 'timestamp', dir: 'DESC' },
  dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  draggableTypes: {
    LIST: 'list',
    BOOKMARK_ITEM: 'bookmarkItem',
    PAGE_ITEM: 'pageItem',
    TH: 'tableHeader'
  },
  filterBrowsers: ['chrome:76', 'firefox:68', 'firefox:49'],
  guestSessionTimeout: '90mins',
  homepageAnnouncement: '',
  internalApiHost: process.env.INTERNAL_HOST,
  internalApiPort: process.env.INTERNAL_PORT,
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  passwordRegex: new RegExp(/(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}/),
  port: process.env.FRONTEND_PORT || 8095,
  product: 'Conifer',
  productLink: 'https://conifer.rhizome.org',
  ravenConfig: null,
  saveDelay: 1000,
  storageKey: 'wr__',
  supportEmail: 'support@conifer.rhizome.org',
  supporterPortal: '',
  tagline: 'Collect and revisit web pages — Free, open-source web archiving service.',
  truncSentence: new RegExp(/([.!?])/),
  truncWord: new RegExp(/(\s)/),
  untitledEntry: '',
  userRegex: new RegExp(/[A-Za-z0-9][\w-]{2,15}/),
  app: {
    title: 'Conifer',
    head: {
      titleTemplate: 'Conifer | %s',
      meta: [
        { name: 'title', content: 'Conifer' },
        { name: 'description', content: 'Collect and revisit web pages — Free, open-source web archiving service.' },
        { charset: 'utf-8' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Conifer' },
        { property: 'og:locale', content: 'en_US' },
        { property: 'og:title', content: 'Conifer' },
        { property: 'og:url', content: 'https://conifer.rhizome.org' },
        { property: 'og:description', content: 'Collect and revisit web pages — Free, open-source web archiving service.' },
        { property: 'og:image', content: `${hostScheme}://${appHost}/static/conifer-social.jpg`, width: '1200', height: '628' },
        { property: 'twitter:card', content: 'summary_large_image' },
        { property: 'twitter:title', content: 'Conifer' },
        { property: 'twitter:description', content: 'Collect and revisit web pages — Free, open-source web archiving service.'},
        { property: 'twitter:image', content: `${hostScheme}://${appHost}/static/conifer-social.jpg`},
      ]
    }
  },

}, localSettings);
