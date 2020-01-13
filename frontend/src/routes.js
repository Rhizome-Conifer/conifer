import HttpStatus from 'components/HttpStatus';
import { ApiDocs, Documentation, FAQ, TermsAndPolicies } from 'components/siteComponents';
import { product } from 'config';

import {
  collDetailBreadcrumb,
  collList,
  listDetailBreadcrumb
} from 'components/siteComponents/BreadcrumbsUI/breadcrumbs';
import {
  CollectionCover,
  CollectionDetail,
  CollectionList,
  CollectionManagement,
  Extract,
  Home,
  ListDetail,
  Login,
  Logout,
  NewPassword,
  NewRecording,
  PasswordReset,
  Patch,
  Record,
  RegisterAccount,
  Replay,
  UserSignup
} from './containers';


const SettingsUI = __DESKTOP__ ?
  require('containers/DesktopSettings/DesktopSettings') :
  require('containers/UserSettings/UserSettings');


const userPath = '/:user([^_][A-Za-z0-9-_]+)';
const userRoutes = [
  /* collection */
  {
    path: userPath,
    breadcrumb: collList,
    component: CollectionList,
    exact: true,
    footer: true,
    name: 'collection'
  },
  {
    path: `${userPath}/_settings`,
    breadcrumb: 'Settings',
    component: SettingsUI,
    exact: true,
    footer: true,
    name: 'settings'
  },
  {
    path: `${userPath}/:coll`,
    breadcrumb: collDetailBreadcrumb,
    classOverride: '',
    component: CollectionCover,
    exact: true,
    footer: false,
    getLocation: ({ user, coll }) => {
      return `/${user}/${coll}`;
    },
    name: 'collectionCover'
  },
  {
    path: `${userPath}/:coll/manage`,
    classOverride: 'direction-override',
    component: CollectionDetail,
    exact: true,
    footer: false,
    managementView: true,
    name: 'collectionPages'
  },
  {
    path: `${userPath}/:coll/management`,
    breadcrumb: 'Management',
    classOverride: '',
    component: CollectionManagement,
    exact: true,
    footer: true,
    managementView: false,
    name: 'collectionMgmt'
  },
  {
    path: `${userPath}/:coll/list/:list`,
    breadcrumb: listDetailBreadcrumb,
    component: ListDetail,
    exact: true,
    footer: false,
    getLocation: ({ user, coll, list }) => {
      return `/${user}/${coll}/list/${list}`;
    },
    name: 'collectionDetailList'
  },
  {
    path: `${userPath}/:coll/list/:list/manage`,
    classOverride: 'direction-override',
    component: CollectionDetail,
    exact: true,
    footer: false,
    managementView: true,
    name: 'collectionDetailListManager'
  }
];

const captureRoutes = [
  {
    path: `${userPath}/:coll/$new`,
    breadcrumb: 'New Session',
    classOverride: '',
    component: NewRecording,
    exact: true,
    footer: false,
    name: 'new recording'
  },
  {
    // record with remote browser id
    path: `${userPath}/:coll/:rec/record/$br::br/:splat(.*)`,
    breadcrumb: 'Recording',
    classOverride: '',
    component: Record,
    exact: true,
    footer: false,
    getLocation: ({ user, coll, rec }) => `/${user}/${coll}/manage?filter=${rec}`,
    name: 'rb record'
  },
  {
    path: `${userPath}/:coll/:rec/record/:splat([^$].*)`,
    breadcrumb: 'Recording',
    classOverride: '',
    component: Record,
    exact: true,
    footer: false,
    getLocation: ({ user, coll, rec }) => `/${user}/${coll}/manage?filter=${rec}`,
    name: 'record'
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    breadcrumb: 'Patching',
    classOverride: '',
    component: Patch,
    exact: true,
    footer: false,
    name: 'rb patch'
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts([0-9]+)?/:splat([^$|^\\d].*)`,
    breadcrumb: 'Patching',
    classOverride: '',
    component: Patch,
    exact: true,
    footer: false,
    name: 'patch'
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode(extract|extract_only)::archiveId:collId([:0-9]+)?/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    breadcrumb: 'Extracting',
    classOverride: '',
    component: Extract,
    exact: true,
    footer: false,
    name: 'rb extract'
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode(extract|extract_only)::archiveId:collId([:0-9]+)?/:ts([0-9]+)?/:splat([^$|^\\d].*)`,
    breadcrumb: 'Extracting',
    classOverride: '',
    component: Extract,
    exact: true,
    footer: false,
    name: 'extract'
  }
]

if (__DESKTOP__) {
  const Live = require('containers/Live/Live');
  // live browser pepare (for desktop)
  captureRoutes.push(
    {
      path: `${userPath}/:coll/live/:splat(.*)`,
      breadcrumb: 'Live',
      classOverride: '',
      component: Live,
      exact: true,
      footer: false,
      name: 'live prepare'
    }
  );
}

const replayRoutes = [
  {
    path: `/:embed(_embed|_embed_noborder)${userPath}/:coll/list/:listSlug/b:bookmarkId([0-9]+)/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Replay,
    embed: true,
    exact: true,
    footer: false,
    name: 'list rb replay embed'
  },
  {
    path: `${userPath}/:coll/list/:listSlug/b:bookmarkId([0-9]+)/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'list rb replay'
  },
  {
    path: `/:embed(_embed|_embed_noborder)${userPath}/:coll/list/:listSlug/b:bookmarkId([0-9]+)/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Replay,
    embed: true,
    exact: true,
    footer: false,
    name: 'list replay embed'
  },
  {
    path: `${userPath}/:coll/list/:listSlug/b:bookmarkId([0-9]+)/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'list replay'
  },
  {
    path: `/:embed(_embed|_embed_noborder)${userPath}/:coll/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Replay,
    embed: true,
    exact: true,
    footer: false,
    name: 'rb replay embed'
  },
  {
    path: `${userPath}/:coll/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'rb replay'
  },
  {
    path: `/:embed(_embed|_embed_noborder)${userPath}/:coll/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Replay,
    embed: true,
    exact: true,
    footer: false,
    name: 'replay embed',
  },
  {
    path: `${userPath}/:coll/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'replay',
  }
];

const infoRoutes = [
  {
    path: '/_faq',
    breadcrumb: 'About',
    component: FAQ,
    exact: true,
    footer: true,
    name: 'FAQ'
  },
  {
    path: '/_policies',
    breadcrumb: 'Terms and Policies',
    component: TermsAndPolicies,
    exact: true,
    footer: true,
    name: 'Terms & Policies'
  },
  {
    path: '/docs',
    component: Documentation,
    name: 'apidocs',
    exact: true,
  },
  {
    breadcrumb: 'Webrecorder API Docs',
    path: '/docs/api',
    component: ApiDocs,
    name: 'apidocs',
    exact: true,
  }
];

export default [
  /* core */
  {
    path: '/',
    component: Home,
    name: 'landing',
    exact: true,
    footer: true
  },
  {
    path: '/_register',
    breadcrumb: 'Register',
    component: UserSignup,
    exact: true,
    footer: true,
    name: 'registration'
  },
  {
    path: '/_valreg/:registration',
    breadcrumb: 'Complete Registration',
    component: RegisterAccount,
    exact: true,
    footer: true,
    name: 'Registering'
  },
  {
    path: '/_forgot',
    breadcrumb: 'Password Reset',
    component: PasswordReset,
    exact: true,
    footer: true,
    name: 'Password Reset'
  },
  {
    path: '/_resetpassword/:resetCode',
    breadcrumb: 'Password Reset',
    component: NewPassword,
    exact: true,
    footer: true,
    name: 'Password Reset'
  },
  {
    path: '/_login',
    breadcrumb: `Log in to ${product}`,
    component: Login,
    exact: true,
    footer: true,
    name: 'login'
  },
  {
    path: '/_logout',
    breadcrumb: 'Logging out..',
    component: Logout,
    exact: true,
    footer: true,
    name: 'logout'
  },

  ...infoRoutes,
  ...userRoutes,
  ...captureRoutes,
  ...replayRoutes,

  {
    path: '/(.*)',
    component: HttpStatus,
    exact: true,
    footer: true,
    name: 'notfound'
  }
];
