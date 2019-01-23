import Indexing from 'containers/Indexing';
import Landing from 'containers/Landing';
import PlayerApp from 'containers/PlayerApp';
import { CollectionCover, ListDetail, Replay } from 'containers';

import Help from 'components/player/Help';
import HttpStatus from 'components/HttpStatus';


export default [
  {
    component: PlayerApp,
    routes: [
      {
        path: '/',
        component: Landing,
        exact: true,
        name: 'landing'
      },
      {
        path: '/:user/:coll',
        classOverride: '',
        component: CollectionCover,
        exact: true,
        footer: true,
        name: 'collectionCover'
      },
      {
        path: '/:user/:coll/list/:list',
        classOverride: 'container',
        component: ListDetail,
        exact: true,
        footer: false,
        name: 'collectionDetailList'
      },
      {
        path: '/:user/:coll/list/:listSlug/b:bookmarkId([0-9]+)/:ts([0-9]+)?/:splat(.*)',
        component: Replay,
        exact: true,
        footer: false,
        name: 'list replay'
      },
      {
        path: '/:user/:coll/:ts([0-9]+)?/:splat(.*)',
        component: Replay,
        exact: true,
        footer: false,
        name: 'replay',
      },
      {
        path: '/indexing',
        component: Indexing,
        exact: true,
        name: 'indexing'
      },
      {
        path: '/help',
        component: Help,
        exact: true,
        name: 'help'
      },
      {
        path: '*',
        component: HttpStatus,
        exact: true,
        name: 'notfound'
      }
    ]
  }
];
