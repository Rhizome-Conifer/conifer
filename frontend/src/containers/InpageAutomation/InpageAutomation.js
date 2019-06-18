import React from 'react';
import { connect } from 'react-redux';

import { inpageCheck, toggleInpageAutomation, toggleInpageSidebar } from 'store/modules/automation';

import { InpageAutomationUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    behavior: app.getIn(['automation', 'behavior']),
    browsers: app.getIn(['remoteBrowsers', 'browsers']),
    inpageInfo: app.getIn(['automation', 'inpageInfo']),
    inpageUrl: app.getIn(['automation', 'inpageUrl']),
    status: app.getIn(['automation', 'inpageStatus']),
    open: app.getIn(['automation', 'inpageAutomation']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleSidebar: b => dispatch(toggleInpageSidebar(b)),
    toggleInpageAutomation: (behavior, status, url) => dispatch(toggleInpageAutomation(behavior, status, url)),
    checkAvailability: url => dispatch(inpageCheck(url))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InpageAutomationUI);
