import React from 'react';
import { connect } from 'react-redux';

import { resetEditState, edit } from 'redux/modules/list';

import { SidebarListViewer } from 'components/controls';


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
    dispatch,
    editList: (user, coll, listId, data) => {
      dispatch(edit(user, coll, listId, data))
        .then(() => setTimeout(() => dispatch(resetEditState()), 3000), () => {});
    }
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarListViewer);
