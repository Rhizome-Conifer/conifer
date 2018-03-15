import React from 'react';
import { connect } from 'react-redux';

import { getActiveBookmark } from 'redux/selectors';

import { SidebarListViewer } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const bkidx = app.getIn(['controls', 'activeBookmarkId']);
  const bookmarks = app.getIn(['list', 'bookmarks']);

  return {
    activeBookmark: bkidx ? bookmarks.findIndex(o => o.get('id') === bkidx) : getActiveBookmark(outerState),
    bookmarks,
    collection: app.get('collection'),
    list: app.get('list')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarListViewer);
