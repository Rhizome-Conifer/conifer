import React from 'react';
import { connect } from 'react-redux';

import { getActiveBookmark } from 'redux/selectors';

import { SidebarListViewer } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;

  return {
    activeBookmark: getActiveBookmark(outerState),
    bookmarks: app.getIn(['list', 'bookmarks']),
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
