import { FAQ, TermsAndPolicies } from 'components/siteComponents';
import {
  collDetailBreadcrumb,
  collList,
  listDetailBreadcrumb,
  recBookmark
} from 'components/siteComponents/BreadcrumbsUI/breadcrumbs';
import {
  CollectionDetail,
  CollectionList,
  CollectionManagement,
  Extract,
  Home,
  HttpStatus,
  Logout,
  NewRecording,
  PasswordReset,
  Patch,
  Record,
  RegisterAccount,
  Replay,
  UserSignup,
  UserSettings
} from './containers';


const userPath = '/:user([A-Za-z0-9-]+)';
const userRoutes = [
  /* collection */
  {
    path: userPath,
    component: CollectionList,
    exact: true,
    name: 'collection',
    footer: true,
    breadcrumb: collList
  },
  {
    path: `${userPath}/_settings`,
    component: UserSettings,
    exact: true,
    name: 'settings',
    footer: true,
    breadcrumb: 'Settings'
  },
  {
    path: '/_valreg/:registration',
    component: RegisterAccount,
    exact: true,
    name: 'Account Registration',
    footer: true
  },
  {
    path: `${userPath}/:coll`,
    component: CollectionDetail,
    exact: true,
    name: 'collectionDetail',
    footer: false,
    classOverride: true,
    breadcrumb: collDetailBreadcrumb
  },
  {
    path: `${userPath}/:coll/management`,
    component: CollectionManagement,
    exact: true,
    name: 'collectionMgmt',
    footer: false,
    classOverride: true,
    breadcrumb: 'Management'
  },
  {
    path: `${userPath}/:coll/list/:list`,
    component: CollectionDetail,
    exact: true,
    name: 'collectionDetailList',
    footer: false,
    classOverride: true,
    breadcrumb: listDetailBreadcrumb,
    getLocation: ({ user, coll, list }) => {
      return `/${user}/${coll}/list/${list.split('-')[0]}`;
    }
  }
];

const controllerRoutes = [
  {
    path: `${userPath}/:coll/$new`,
    name: 'new recording',
    footer: false,
    classOverride: true,
    component: NewRecording,
    exact: true,
    breadcrumb: 'New Recording'
  },
  {
    // record with remote browser id
    path: `${userPath}/:coll/:rec/record/$br::br/:splat(.*)`,
    name: 'rb record',
    footer: false,
    classOverride: true,
    component: Record,
    exact: true,
    breadcrumb: recBookmark,
    getLocation: ({ user, coll, rec }) => `/${user}/${coll}?filter=${rec}`
  },
  {
    path: `${userPath}/:coll/:rec/record/:splat(.*)`,
    name: 'record',
    footer: false,
    classOverride: true,
    component: Record,
    exact: true,
    breadcrumb: recBookmark,
    getLocation: ({ user, coll, rec }) => `/${user}/${coll}?filter=${rec}`
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts([0-9]+)?/:splat(.*)`,
    name: 'patch',
    footer: false,
    classOverride: true,
    component: Patch,
    exact: true
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    name: 'rb patch',
    footer: false,
    classOverride: true,
    component: Patch,
    exact: true
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode(extract|extract_only)::archiveId:collId([:0-9]+)?/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    name: 'rb extract',
    footer: false,
    classOverride: true,
    component: Extract,
    exact: true
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode(extract|extract_only)::archiveId:collId([:0-9]+)?/:ts([0-9]+)?/:splat(.*)`,
    name: 'extract',
    footer: false,
    classOverride: true,
    component: Extract,
    exact: true
  },
  {
    path: `${userPath}/:coll/list/:listId([a-zA-Z0-9]+)-:bookmarkId([a-zA-Z0-9]+)/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    name: 'list rb replay',
    footer: false,
    classOverride: true,
    component: Replay,
    exact: true
  },
  {
    path: `${userPath}/:coll/list/:listId([a-zA-Z0-9]+)-:bookmarkId([a-zA-Z0-9]+)/:ts([0-9]+)?/:splat(.*)`,
    name: 'list replay',
    footer: false,
    classOverride: true,
    component: Replay,
    exact: true
  },
  {
    path: `${userPath}/:coll/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    name: 'rb replay',
    footer: false,
    classOverride: true,
    component: Replay,
    exact: true
  },
  {
    path: `${userPath}/:coll/:ts([0-9]+)?/:splat(.*)`,
    name: 'replay',
    footer: false,
    classOverride: true,
    component: Replay,
    exact: true
  }
];

const infoRoutes = [
  {
    path: '/_faq',
    name: 'FAQ',
    footer: true,
    component: FAQ,
    exact: true
  },
  {
    path: '/_policies',
    name: 'Terms & Policies',
    footer: true,
    component: TermsAndPolicies,
    exact: true
  }
];

export default [
  /* core */
  {
    path: '/',
    component: Home,
    footer: true,
    exact: true,
    breadcrumb: 'Webrecorder',
  },
  {
    path: '/_register',
    name: 'registration',
    footer: true,
    component: UserSignup,
    exact: true
  },
  {
    path: '/_forgot',
    name: 'Password Reset',
    footer: true,
    component: PasswordReset,
    exact: true
  },
  {
    path: '/_logout',
    name: 'logout',
    footer: false,
    component: Logout,
    exact: true
  },

  ...infoRoutes,
  ...userRoutes,
  ...controllerRoutes.map(o => ({ ...o, noShadow: true })),

  {
    path: '/(.*)',
    name: 'notfound',
    footer: true,
    component: HttpStatus,
    exact: true
  }
];
