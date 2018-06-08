import { fromJS } from 'immutable';

import { apiPath } from 'config';


const LIST_CREATE = 'wr/list/LIST_CREATE';
const LIST_CREATE_SUCCESS = 'wr/list/LIST_CREATE_SUCCESS';
const LIST_CREATE_FAIL = 'wr/list/LIST_CREATE_FAIL';

const LIST_LOAD = 'wr/list/LIST_LOAD';
const LIST_LOAD_SUCCESS = 'wr/list/LIST_LOAD_SUCCESS';
const LIST_LOAD_FAIL = 'wr/list/LIST_LOAD_FAIL';

const LIST_ADD = 'wr/list/LIST_ADD';
const LIST_ADD_SUCCESS = 'wr/list/LIST_ADD_SUCCESS';
const LIST_ADD_FAIL = 'wr/list/LIST_ADD_FAIL';

const BULK_ADD = 'wr/list/BULK_ADD';
const BULK_ADD_SUCCESS = 'wr/list/BULK_ADD_SUCCESS';
const BULK_ADD_FAIL = 'wr/list/BULK_ADD_FAIL';

const LIST_EDIT = 'wr/list/LIST_EDIT';
const LIST_EDIT_SUCCESS = 'wr/list/LIST_EDIT_SUCCESS';
const LIST_EDIT_FAIL = 'wr/list/LIST_EDIT_FAIL';
const LIST_EDITED_RESET = 'wr/list/LIST_EDITED_RESET';

const BOOKMARK_REORDER = 'wr/list/BOOKMARK_REORDER';
const BOOKMARK_REORDER_SUCCESS = 'wr/list/BOOKMARK_REORDER_SUCCESS';
const BOOKMARK_REORDER_FAIL = 'wr/list/BOOKMARK_REORDER_FAIL';

const LIST_REMOVE = 'wr/list/LIST_REMOVE';
const LIST_REMOVE_SUCCESS = 'wr/list/LIST_REMOVE_SUCCESS';
const LIST_REMOVE_FAIL = 'wr/list/LIST_REMOVE_FAIL';

const BOOKMARK_EDIT = 'wr/list/BOOKMARK_EDIT';
const BOOKMARK_EDIT_SUCCESS = 'wr/list/BOOKMARK_EDIT_SUCCESS';
const BOOKMARK_EDIT_FAIL = 'wr/list/BOOKMARK_EDIT_FAIL';
const RESET_BOOKMARK_EDIT = 'wr/list/RESET_BOOKMARK_EDIT';

const BOOKMARK_REMOVE = 'wr/list/BOOKMARK_REMOVE';
const BOOKMARK_REMOVE_SUCCESS = 'wr/list/BOOKMARK_REMOVE_SUCCESS';
const BOOKMARK_REMOVE_FAIL = 'wr/list/BOOKMARK_REMOVE_FAIL';


const initialState = fromJS({
  bookmarks: [],
  bkEdited: false,
  bkDeleting: false,
  bkDeleteError: null,
  deleting: false,
  deleteError: null,
  editing: false,
  edited: false,
  loading: false,
  loaded: false,
  error: null
});


export default function list(state = initialState, action = {}) {
  switch (action.type) {
    case BOOKMARK_REMOVE:
      return state.set('bkDeleting', true);
    case BOOKMARK_REMOVE_SUCCESS:
      return state.set('bkDeleting', false);
    case BOOKMARK_REMOVE_FAIL:
      return state.merge({
        bkDeleting: false,
        bkDeleteError: action.error.error
      });
    case BOOKMARK_REORDER_SUCCESS:
      return state.set(
        'bookmarks',
        state.get('bookmarks').sort((a, b) => {
          const aidx = action.order.indexOf(a.get('id'));
          const bidx = action.order.indexOf(b.get('id'));

          if (aidx < bidx) return -1;
          if (aidx > bidx) return 1;
          return 0;
        })
      );
    case LIST_EDIT:
      return state.set('editing', true);
    case LIST_EDIT_SUCCESS: {
      const edits = action.id === state.get('id') ? action.data : {};
      return state.merge({
        editing: false,
        edited: true,
        ...edits
      });
    }
    case LIST_EDIT_FAIL: {
      return state.merge({
        error: action.error.error
      });
    }
    case LIST_REMOVE:
      return state.set('deleting', true);
    case LIST_REMOVE_SUCCESS:
      return state.set('deleting', false);
    case LIST_REMOVE_FAIL:
      return state.merge({
        deleting: false,
        deleteError: action.error.error
      });
    case LIST_EDITED_RESET:
      return state.set('edited', false);
    case LIST_LOAD:
      return state.merge({
        loading: true,
        loaded: false,
        error: null
      });
    case LIST_LOAD_SUCCESS:
      return state.merge({
        loading: false,
        loaded: true,
        error: null,
        ...action.result.list,
        bookmarks: fromJS(action.result.list.bookmarks)
      });
    case LIST_LOAD_FAIL:
      return state.merge(action.error);
    case BOOKMARK_EDIT_SUCCESS:
      return state.set('bkEdited', true);
    case RESET_BOOKMARK_EDIT:
      return state.set('bkEdited', false);
    default:
      return state;
  }
}


export function listLoaded(id, { app }) {
  // TODO: add accessed check
  return app.getIn(['list', 'loaded']) &&
         id === app.getIn(['list', 'id']);
}


export function create(user, coll, title) {
  return {
    types: [LIST_CREATE, LIST_CREATE_SUCCESS, LIST_CREATE_FAIL],
    promise: client => client.post(`${apiPath}/lists`, {
      params: { user, coll: decodeURIComponent(coll) },
      data: { title, public: true }
    })
  };
}


export function load(user, coll, id, host = '') {
  return {
    types: [LIST_LOAD, LIST_LOAD_SUCCESS, LIST_LOAD_FAIL],
    promise: client => client.get(`${host}${apiPath}/list/${id}`, {
      params: { user, coll: decodeURIComponent(coll) }
    })
  };
}


export function edit(user, coll, id, data) {
  return {
    types: [LIST_EDIT, LIST_EDIT_SUCCESS, LIST_EDIT_FAIL],
    promise: client => client.post(`${apiPath}/list/${id}`, {
      params: { user, coll: decodeURIComponent(coll) },
      data
    }),
    data,
    id
  };
}


export function addTo(user, coll, listId, page) {
  return {
    types: [LIST_ADD, LIST_ADD_SUCCESS, LIST_ADD_FAIL],
    promise: client => client.post(`${apiPath}/list/${listId}/bookmarks`, {
      params: { user, coll: decodeURIComponent(coll) },
      data: page
    })
  };
}


export function bulkAddTo(user, coll, listId, pages) {
  return {
    types: [BULK_ADD, BULK_ADD_SUCCESS, BULK_ADD_FAIL],
    promise: client => client.post(`${apiPath}/list/${listId}/bulk_bookmarks`, {
      params: { user, coll: decodeURIComponent(coll) },
      data: pages
    })
  };
}


export function editBookmark(user, coll, list, bkId, data) {
  return {
    types: [BOOKMARK_EDIT, BOOKMARK_EDIT_SUCCESS, BOOKMARK_EDIT_FAIL],
    promise: client => client.post(`${apiPath}/bookmark/${bkId}`, {
      params: { user, coll: decodeURIComponent(coll), list },
      data: {
        ...data
      }
    })
  };
}


export function resetBookmarkEdit() {
  return { type: RESET_BOOKMARK_EDIT };
}


export function removeBookmark(user, coll, listId, bookmarkId) {
  return {
    types: [BOOKMARK_REMOVE, BOOKMARK_REMOVE_SUCCESS, BOOKMARK_REMOVE_FAIL],
    promise: client => client.del(`${apiPath}/bookmark/${bookmarkId}`, {
      params: { user, coll: decodeURIComponent(coll), list: listId }
    })
  };
}


export function resetEditState() {
  return { type: LIST_EDITED_RESET };
}


export function bookmarkSort(user, coll, id, order) {
  return {
    types: [BOOKMARK_REORDER, BOOKMARK_REORDER_SUCCESS, BOOKMARK_REORDER_FAIL],
    order,
    promise: client => client.post(`${apiPath}/list/${id}/bookmarks/reorder`, {
      params: { user, coll: decodeURIComponent(coll) },
      data: {
        order
      }
    })
  };
}


export function deleteList(user, coll, id) {
  return {
    types: [LIST_REMOVE, LIST_REMOVE_SUCCESS, LIST_REMOVE_FAIL],
    promise: client => client.del(`${apiPath}/list/${id}`, {
      params: { user, coll: decodeURIComponent(coll) }
    })
  };
}
