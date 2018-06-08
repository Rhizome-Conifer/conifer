import React from 'react';
import { connect } from 'react-redux';

import { saveDelay } from 'config';

import { clear, selectBookmark } from 'store/modules/inspector';
import { resetEditState, edit } from 'store/modules/list';

import { SidebarListViewerUI } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const bkidx = app.getIn(['controls', 'activeBookmarkId']);
  const bookmarks = app.getIn(['list', 'bookmarks']);

  return {
    activeBookmark: bkidx ? bookmarks.findIndex(o => o.get('id') === bkidx) : -1,
    bookmarks,
    collection: app.get('collection'),
    list: app.get('list'),
    listEdited: app.getIn(['list', 'edited']),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    clearInspector: () => dispatch(clear()),
    editList: (user, coll, listId, data) => {
      dispatch(edit(user, coll, listId, data))
        .then(() => setTimeout(() => dispatch(resetEditState()), saveDelay), () => {});
    },
    setInspector: bk => dispatch(selectBookmark(bk)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarListViewerUI);
