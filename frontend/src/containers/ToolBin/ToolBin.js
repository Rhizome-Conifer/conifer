import React from 'react';
import { connect } from 'react-redux';

import { setAutoscroll } from 'redux/modules/controls';
import { toggleClipboard } from 'redux/modules/toolBin';
import { getPageCount } from 'redux/selectors';

import { ToolBinUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    autoscroll: app.getIn(['controls', 'autoscroll']),
    open: app.getIn(['toolBin', 'open']),
    collSize: app.getIn(['collection', 'size']),
    pageCount: getPageCount(app)
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleClipboard: b => dispatch(toggleClipboard(b)),
    toggleAutoscroll: b => dispatch(setAutoscroll(b))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ToolBinUI);
