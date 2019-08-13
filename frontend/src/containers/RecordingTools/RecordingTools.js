import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { toggleAutopilotSidebar } from 'store/modules/automation';
import { setAutoscroll } from 'store/modules/controls';
import { toggleClipboard } from 'store/modules/toolBin';

import { RecordingToolsUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    autopilotInfo: app.getIn(['automation', 'autopilotInfo']),
    auth: app.getIn(['auth', 'user']),
    autopilot: app.getIn(['automation', 'autopilot']),
    reqId: app.getIn(['remoteBrowsers', 'reqId']),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleClipboard: b => dispatch(toggleClipboard(b)),
    toggleAutoscroll: b => dispatch(setAutoscroll(b)),
    toggleAutopilotSidebar: b => dispatch(toggleAutopilotSidebar(b))
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(RecordingToolsUI));
