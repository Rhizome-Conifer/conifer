import React from 'react';
import { connect } from 'react-redux';

import { toggleInpageSidebar } from 'store/modules/automation';
import { selectBrowser } from 'store/modules/remoteBrowsers';

import { InpageAutomationUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    browsers: app.getIn(['remoteBrowsers', 'browsers']),
    running: app.getIn(['automation', 'inpageRunning']),
    open: app.getIn(['automation', 'inpageAutomation']),
    selectedBrowser: app.getIn(['remoteBrowsers', 'selectedBrowser'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    selectRemoteBrowser: br => dispatch(selectBrowser(br)),
    toggleInpageAutomation: b => dispatch(toggleInpageSidebar(b))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InpageAutomationUI);
