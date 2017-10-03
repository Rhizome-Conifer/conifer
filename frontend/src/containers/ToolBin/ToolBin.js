import React from 'react';
import { connect } from 'react-redux';

import { getBookmarkCount } from 'redux/selectors';

import { ToolBinUI } from 'components/controls';


const mapStateToProps = (state, context) => {
  return {
    activeBrowser: state.getIn(['remoteBrowsers', 'activeBrowser']),
    open: state.getIn(['toolBin', 'open']),
    collSize: state.getIn(['collection', 'size']),
    bookmarkCount: getBookmarkCount(state)
  };
};

export default connect(
  mapStateToProps
)(ToolBinUI);
