import HttpStatus from 'components/HttpStatus';
import { FAQ, TermsAndPolicies } from 'components/siteComponents';
import {
  collDetailBreadcrumb,
  collList,
  listDetailBreadcrumb,
  recBookmark
} from 'components/siteComponents/BreadcrumbsUI/breadcrumbs';
import {
  CollectionCover,
  CollectionDetail,
  CollectionList,
  CollectionManagement,
  Extract,
  Home,
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
    breadcrumb: collList,
    component: CollectionList,
    exact: true,
    footer: true,
    name: 'collection'
  },
  {
    path: `${userPath}/_settings`,
    breadcrumb: 'Settings',
    component: UserSettings,
    exact: true,
    footer: true,
    name: 'settings'
  },
  {
    path: `${userPath}/:coll`,
    breadcrumb: collDetailBreadcrumb,
    component: CollectionCover,
    exact: true,
    footer: true,
    getLocation: ({ user, coll }) => {
      return `/${user}/${coll}/pages`;
    },
    name: 'collectionCover'
  },
  {
    path: `${userPath}/:coll/pages`,
    breadcrumb: 'Pages',
    classOverride: 'direction-override',
    component: CollectionDetail,
    exact: true,
    footer: false,
    name: 'collectionPages'
  },
  {
    path: `${userPath}/:coll/management`,
    breadcrumb: 'Management',
    classOverride: '',
    component: CollectionManagement,
    exact: true,
    footer: false,
    name: 'collectionMgmt'
  },
  {
    path: `${userPath}/:coll/list/:list`,
    breadcrumb: listDetailBreadcrumb,
    classOverride: 'direction-override',
    component: CollectionDetail,
    exact: true,
    footer: false,
    getLocation: ({ user, coll, list }) => {
      return `/${user}/${coll}/list/${list.split('-')[0]}`;
    },
    name: 'collectionDetailList'
  }
];

const controllerRoutes = [
  {
    path: `${userPath}/:coll/$new`,
    name: 'new recording',
    footer: false,
    classOverride: '',
    component: NewRecording,
    exact: true,
    breadcrumb: 'New Recording'
  },
  {
    // record with remote browser id
    path: `${userPath}/:coll/:rec/record/$br::br/:splat(.*)`,
    breadcrumb: recBookmark,
    classOverride: '',
    component: Record,
    exact: true,
    footer: false,
    getLocation: ({ user, coll, rec }) => `/${user}/${coll}?filter=${rec}`,
    name: 'rb record'
  },
  {
    path: `${userPath}/:coll/:rec/record/:splat(.*)`,
    breadcrumb: recBookmark,
    classOverride: '',
    component: Record,
    exact: true,
    footer: false,
    getLocation: ({ user, coll, rec }) => `/${user}/${coll}?filter=${rec}`,
    name: 'record'
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Patch,
    exact: true,
    footer: false,
    name: 'patch'
  },
  {
    path: `${userPath}/:coll/:rec/patch/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Patch,
    exact: true,
    footer: false,
    name: 'rb patch'
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode(extract|extract_only)::archiveId:collId([:0-9]+)?/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Extract,
    exact: true,
    footer: false,
    name: 'rb extract'
  },
  {
    path: `${userPath}/:coll/:rec/:extractMode(extract|extract_only)::archiveId:collId([:0-9]+)?/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Extract,
    exact: true,
    footer: false,
    name: 'extract'
  },
  {
    path: `${userPath}/:coll/list/:listId([a-zA-Z0-9]+)-:bookmarkId([a-zA-Z0-9]+)/:ts([0-9]+)?$br::br([a-z0-9-:]+)/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'list rb replay'
  },
  {
    path: `${userPath}/:coll/list/:listId([a-zA-Z0-9]+)-:bookmarkId([a-zA-Z0-9]+)/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'list replay'
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
    path: `${userPath}/:coll/:ts([0-9]+)?/:splat(.*)`,
    classOverride: '',
    component: Replay,
    exact: true,
    footer: false,
    name: 'replay'
  }
];

const infoRoutes = [
  {
    path: '/_faq',
    component: FAQ,
    exact: true,
    footer: true,
    name: 'FAQ'
  },
  {
    path: '/_policies',
    component: TermsAndPolicies,
    exact: true,
    footer: true,
    name: 'Terms & Policies'
  }
];

export default [
  /* core */
  {
    path: '/',
    breadcrumb: 'Webrecorder',
    component: Home,
    exact: true,
    footer: true
  },
  {
    path: '/_register',
    component: UserSignup,
    exact: true,
    footer: true,
    name: 'registration'
  },
  {
    path: '/_valreg/:registration',
    component: RegisterAccount,
    exact: true,
    footer: true,
    name: 'Account Registration'
  },
  {
    path: '/_forgot',
    component: PasswordReset,
    exact: true,
    footer: true,
    name: 'Password Reset'
  },
  {
    path: '/_logout',
    component: Logout,
    exact: true,
    footer: true,
    name: 'logout'
  },

  ...infoRoutes,
  ...userRoutes,
  ...controllerRoutes.map(o => ({ ...o, noShadow: true })),

  {
    path: '/(.*)',
    component: HttpStatus,
    exact: true,
    footer: true,
    name: 'notfound'
  }
];
