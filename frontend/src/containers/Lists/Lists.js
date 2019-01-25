import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import {
  edit as editCollection,
  loadLists,
  load as loadColl,
  resetEditState as resetCollEditState,
  sortLists,
  getBookmarkCount
} from 'store/modules/collection';
import { addTo, bulkAddBatch, bulkAddTo, create, deleteList, edit, resetEditState } from 'store/modules/list';

import ListsUI from 'components/collection/ListsUI';


const mapStateToProps = ({ app }) => {
  return {
    bulkAdding: app.getIn(['list', 'adding']),
    collection: app.get('collection'),
    deleting: app.getIn(['list', 'deleting']),
    deleteError: app.getIn(['list', 'deleteError']),
    lists: app.getIn(['collection', 'lists']),
    list: app.get('list'),
    publicIndex: app.getIn(['collection', 'public_index']),
    isCreating: app.getIn(['list', 'creating']),
    created: app.getIn(['list', 'created'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createList: (user, coll, title) => {
      return dispatch(create(user, coll, title))
        .then(() => dispatch(loadLists(user, coll)));
    },
    addToList: (user, coll, listId, data) => {
      dispatch(addTo(user, coll, listId, data))
        .then(() => dispatch(getBookmarkCount(user, coll, listId)));
    },
    bulkAddToList: (user, coll, listId, pages) => {
      const delay = (action, ms) => {
        return new Promise(
          resolve => setTimeout(
            () => dispatch(action()).then(resolve),
            ms
          )
        );
      };

      dispatch(bulkAddBatch(listId));
      // TODO: delay might not be necessary
      dispatch(bulkAddTo(user, coll, listId, pages))
        .then(() => delay(() => getBookmarkCount(user, coll, listId), 1500))
        .then(() => dispatch(bulkAddBatch()));
    },
    editColl: (user, coll, data) => {
      return dispatch(editCollection(user, coll, data))
        .then(() => dispatch(resetCollEditState()))
        .then(() => dispatch(loadColl(user, coll)));
    },
    editList: (user, coll, id, data) => {
      return dispatch(edit(user, coll, id, data))
        .then(() => dispatch(loadLists(user, coll)))
        .then(() => setTimeout(() => dispatch(resetEditState()), saveDelay));
    },
    sortLists: (user, coll, ids) => dispatch(sortLists(user, coll, ids)),
    deleteList: (user, coll, id) => {
      return dispatch(deleteList(user, coll, id))
        .then(() => dispatch(loadLists(user, coll)));
    }
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(ListsUI));
