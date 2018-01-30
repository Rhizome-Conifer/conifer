import { FAQ, TermsAndPolicies } from 'components/siteComponents';
import { collDetailBookmark, collList } from 'components/siteComponents/BreadcrumbsUI/breadcrumbs';
import {
  CollectionDetail,
  CollectionList,
  Extract,
  Home,
  HttpStatus,
  Logout,
  NewRecording,
  PasswordReset,
  Patch,
  Record,
  Replay,
  UserSignup,
  UserSettings
} from './containers';


const userPath = '/:user([^_][A-Za-z0-9]+)';
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
  { /* TODO: add auth check */
    path: `${userPath}/_settings`,
    component: UserSettings,
    exact: true,
    name: 'settings',
    footer: true,
    breadcrumb: 'Settings'
  },
  {
    path: `${userPath}/:coll`,
    component: CollectionDetail,
    exact: true,
    name: 'collectionDetail',
    footer: false,
    classOverride: true,
    breadcrumb: collDetailBookmark
  }
];

const controllerRoutes = [
  /* TODO: add permissions check */
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
    name: 'record',
    footer: false,
    classOverride: true,
    component: Record,
    exact: true,
    breadcrumb: false
  },
  {
    path: `${userPath}/:coll/:rec/record/:splat(.*)`,
    name: 'record',
    footer: false,
    classOverride: true,
    component: Record,
    exact: true,
    breadcrumb: false
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts/:splat(.*)`,
    name: 'patch',
    footer: false,
    classOverride: true,
    component: Patch,
    exact: true,
    breadcrumb: false
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode::archiveId(::collId)/:ts/:splat(.*)`,
    name: 'extract',
    footer: false,
    classOverride: true,
    component: Extract,
    exact: true,
    breadcrumb: false
  },
  {
    path: `${userPath}/:coll/:ts/:splat(.*)`,
    name: 'replay',
    footer: false,
    classOverride: true,
    component: Replay,
    exact: true,
    breadcrumb: false
  }
];

const infoRoutes = [
  {
    path: '/_faq',
    name: 'FAQ',
    footer: true,
    component: FAQ,
    exact: true,
    breadcrumb: false
  },
  {
    path: '/_policies',
    name: 'Terms & Policies',
    footer: true,
    component: TermsAndPolicies,
    exact: true,
    breadcrumb: false
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
    exact: true,
    breadcrumb: false
  },
  {
    path: '/_forgot',
    name: 'Password Reset',
    footer: true,
    component: PasswordReset,
    exact: true,
    breadcrumb: false
  },
  {
    path: '/_logout',
    name: 'logout',
    footer: false,
    component: Logout,
    exact: true,
    breadcrumb: false
  },

  ...infoRoutes,
  ...controllerRoutes,
  ...userRoutes,

  {
    path: '/(.*)',
    name: 'notfound',
    footer: true,
    component: HttpStatus,
    exact: true,
    breadcrumb: false
  }
];
