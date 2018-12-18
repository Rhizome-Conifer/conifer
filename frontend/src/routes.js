import HttpStatus from 'components/HttpStatus';
import { FAQ, TermsAndPolicies } from 'components/siteComponents';
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
  Logout,
  NewPassword,
  NewRecording,
  PasswordReset,
  Patch,
  Record,
  RegisterAccount,
  Replay,
  UserSignup,
  UserSettings
} from './containers';


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
    component: UserSettings,
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
    managementView: true,
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

const controllerRoutes = [
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
  },
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
  }
];

export default [
  /* core */
  {
    path: '/',
    component: Home,
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
    breadcrumb: 'Registering',
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
    path: '/_logout',
    breadcrumb: 'Logging out..',
    component: Logout,
    exact: true,
    footer: true,
    name: 'logout'
  },

  ...infoRoutes,
  ...userRoutes,
  ...controllerRoutes,

  {
    path: '/(.*)',
    component: HttpStatus,
    exact: true,
    footer: true,
    name: 'notfound'
  }
];
