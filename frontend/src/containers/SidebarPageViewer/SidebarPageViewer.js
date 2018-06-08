import React from 'react';
import { connect } from 'react-redux';

import { selectPage } from 'store/modules/inspector';
import { getActivePageIdx, timestampOrderedPages } from 'store/selectors';

import { SidebarPageViewerUI } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;

  return {
    activePage: getActivePageIdx(outerState),
    pages: timestampOrderedPages(app),
    collection: app.get('collection')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setInspector: pg => dispatch(selectPage(pg)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarPageViewerUI);
