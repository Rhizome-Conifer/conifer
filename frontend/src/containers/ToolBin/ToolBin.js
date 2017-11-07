import React from 'react';
import { connect } from 'react-redux';

import { getBookmarkCount } from 'redux/selectors';

import { ToolBinUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    open: app.getIn(['toolBin', 'open']),
    collSize: app.getIn(['collection', 'size']),
    bookmarkCount: getBookmarkCount(app)
  };
};

export default connect(
  mapStateToProps
)(ToolBinUI);
