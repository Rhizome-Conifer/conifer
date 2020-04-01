import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import { load as loadColl } from 'store/modules/collection';
import {
  bookmarkSort,
  edit as editList,
  setSort,
  resetEditState
} from 'store/modules/list';
import { getOrderedBookmarks } from 'store/selectors';


import ListHeaderUI from 'components/collection/ListHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    list: app.get('list'),
    listEditing: app.getIn(['list', 'editing']),
    listEdited: app.getIn(['list', 'edited']),
    listError: app.getIn(['list', 'error']),
    ordererdBookmarks: getOrderedBookmarks(app),
    sort: app.getIn(['list', 'sortBy'])
  };
};

const mapDispatchToProps = (dispatch, { history, match: { params: { user, coll } } }) => {
  return {
    clearSort: () => dispatch(setSort({ sort: null, dir: null })),
    editList: (listId, data) => {
      dispatch(editList(user, coll, listId, data))
        .then((res) => {
          if (data.hasOwnProperty('title')) {
            history.replace(`/${user}/${coll}/list/${res.list.slug}/manage`);
          }
          return dispatch(loadColl(user, coll));
        }, () => {})
        .then(() => dispatch(resetEditState()), () => {});
    },
    saveBookmarkSort: async (list, ids) => {
      await dispatch(bookmarkSort(user, coll, list, ids));
      dispatch(setSort({ sort: null, dir: null }));
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(ListHeaderUI));
