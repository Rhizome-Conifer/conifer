import { apiPath } from 'config';
import { fromJS } from 'immutable';

const BK_COUNT = 'wr/coll/BK_COUNT';
const BK_COUNT_SUCCESS = 'wr/coll/BK_COUNT_SUCCESS';
const BK_COUNT_FAIL = 'wr/coll/BK_COUNT_FAIL';

const COLL_LOAD = 'wr/coll/COLL_LOAD';
const COLL_LOAD_SUCCESS = 'wr/coll/COLL_LOAD_SUCCESS';
const COLL_LOAD_FAIL = 'wr/coll/COLL_LOAD_FAIL';

const COLL_EDIT = 'wr/coll/COLL_EDIT';
const COLL_EDIT_SUCCESS = 'wr/coll/COLL_EDIT_SUCCESS';
const COLL_EDIT_FAIL = 'wr/coll/COLL_EDIT_FAIL';
const RESET_EDIT_STATE = 'wr/coll/RESET_EDIT_STATE';

const COLL_DELETE = 'wr/coll/COLL_DELETE';
const COLL_DELETE_SUCCESS = 'wr/coll/COLL_DELETE_SUCCESS';
const COLL_DELETE_FAIL = 'wr/coll/COLL_DELETE_FAIL';

const LISTS_LOAD = 'wr/coll/LISTS_LOAD';
const LISTS_LOAD_SUCCESS = 'wr/coll/LISTS_LOAD_SUCCESS';
const LISTS_LOAD_FAIL = 'wr/coll/LISTS_LOAD_FAIL';

const LISTS_REORDER = 'wr/coll/LISTS_REORDER';
const LISTS_REORDER_SUCCESS = 'wr/coll/LISTS_REORDER_SUCCESS';
const LISTS_REORDER_FAIL = 'wr/coll/LISTS_REORDER_FAIL';

const COLL_SET_SORT = 'wr/coll/COLL_SET_SORT';
const COLL_SET_PUBLIC = 'wr/coll/SET_PUBLIC';
const COLL_SET_PUBLIC_SUCCESS = 'wr/coll/SET_PUBLIC_SUCCESS';
const COLL_SET_PUBLIC_FAIL = 'wr/coll/SET_PUBLIC_FAIL';

export const defaultSort = { sort: 'timestamp', dir: 'DESC' };
const initialState = fromJS({
  edited: false,
  editError: null,
  error: null,
  loading: false,
  loaded: false,
  sortBy: defaultSort
});


export default function collection(state = initialState, action = {}) {
  switch (action.type) {
    case BK_COUNT_SUCCESS: {
      const idx = state.get('lists').findIndex(l => l.get('id') === action.list);
      return state.setIn(['lists', idx, 'total_bookmarks'], action.result.list.total_bookmarks);
    }
    case COLL_DELETE:
      return state.merge({
        edited: false,
        editing: true,
        editError: null
      });
    case COLL_DELETE_SUCCESS:
      return state.merge({
        edited: true,
        editing: false
      });
    case COLL_DELETE_FAIL:
      return state.merge({
        edited: false,
        editing: false,
        editError: action.error.error
      });
    case COLL_LOAD:
      return state.set('loading', true);
    case COLL_EDIT_SUCCESS:
    case COLL_LOAD_SUCCESS: {
      const {
        collection: {
          created_at,
          desc,
          duration,
          featured_list,
          id,
          lists,
          owner,
          pages,
          public_index,
          recordings,
          size,
          slug,
          slug_matched,
          timespan,
          title,
          updated_at
        }
      } = action.result;

      const pgs = {};
      if (pages) {
        pages.forEach((pg) => { pgs[pg.id] = pg; });
      }

      let editState = {};
      if (action.type === COLL_EDIT_SUCCESS) {
        editState = {
          edited: true,
          editError: null
        };
      }

      return state.merge({
        loading: false,
        loaded: true,
        accessed: action.accessed,
        error: null,
        ...editState,

        pages: pgs,
        created_at,
        desc,
        duration,
        id,
        featured_list,
        'public': action.result.collection.public,
        public_index,
        lists,
        owner,
        recordings,
        size,
        slug,
        slug_matched,
        timespan,
        title,
        updated_at
      });
    }
    case COLL_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case COLL_SET_PUBLIC_SUCCESS:
      return state.set('public', action.result.is_public);

    case COLL_SET_SORT:
      return state.merge({
        sortBy: action.sortBy
      });

    case LISTS_LOAD_SUCCESS:
      return state.merge({
        lists: action.result.lists
      });
    case LISTS_REORDER_SUCCESS:
      return state.set(
        'lists',
        state.get('lists').sort((a, b) => {
          const aidx = action.order.indexOf(a.get('id'));
          const bidx = action.order.indexOf(b.get('id'));

          if (aidx < bidx) return -1;
          if (aidx > bidx) return 1;
          return 0;
        })
      );
    case COLL_EDIT_FAIL:
      return state.merge({
        editError: action.error.error
      });
    case RESET_EDIT_STATE:
      return state.set('edited', false);

    case LISTS_LOAD_FAIL:
    case LISTS_LOAD:
    case COLL_SET_PUBLIC:
    case COLL_SET_PUBLIC_FAIL:
    default:
      return state;
  }
}


export function isLoaded({ app }) {
  return app.get('collection') &&
         app.getIn(['collection', 'loaded']) &&
         Date.now() - app.getIn(['collection', 'accessed']) < 15 * 60 * 1000;
}


export function resetEditState() {
  return { type: RESET_EDIT_STATE };
}


export function load(user, coll) {
  return {
    types: [COLL_LOAD, COLL_LOAD_SUCCESS, COLL_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${apiPath}/collection/${coll}`, {
      params: { user }
    })
  };
}


/**
 * withBookmarks accepts `first` or `all` for `include_bookmarks` query prop
 */
export function loadLists(user, coll, withBookmarks = 'first') {
  return {
    types: [LISTS_LOAD, LISTS_LOAD_SUCCESS, LISTS_LOAD_FAIL],
    promise: client => client.get(`${apiPath}/lists`, {
      params: { user, coll, include_bookmarks: withBookmarks }
    })
  };
}


export function sortLists(user, coll, order) {
  return {
    types: [LISTS_REORDER, LISTS_REORDER_SUCCESS, LISTS_REORDER_FAIL],
    order,
    promise: client => client.post(`${apiPath}/lists/reorder`, {
      params: { user, coll },
      data: {
        order
      }
    })
  };
}


export function edit(user, coll, data) {
  return {
    types: [COLL_EDIT, COLL_EDIT_SUCCESS, COLL_EDIT_FAIL],
    promise: client => client.post(`${apiPath}/collection/${coll}`, {
      params: { user },
      data
    }),
    data
  };
}


export function deleteCollection(user, coll) {
  return {
    types: [COLL_DELETE, COLL_DELETE_SUCCESS, COLL_DELETE_FAIL],
    promise: client => client.del(`${apiPath}/collection/${coll}`, {
      params: { user }
    })
  };
}


export function setSort(sortBy) {
  return {
    type: COLL_SET_SORT,
    sortBy
  };
}

export function getBookmarkCount(user, coll, list) {
  return {
    types: [BK_COUNT, BK_COUNT_SUCCESS, BK_COUNT_FAIL],
    list,
    promise: client => client.get(`${apiPath}/list/${list}`, {
      params: { user, coll, include_bookmarks: 'none' }
    })
  };
}
