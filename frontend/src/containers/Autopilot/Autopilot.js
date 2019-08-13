import React from 'react';
import { connect } from 'react-redux';

import {
  autopilotCheck,
  autopilotReset,
  toggleAutopilot,
  toggleAutopilotSidebar
} from 'store/modules/automation';

import { AutopilotUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    autopilot: app.getIn(['automation', 'autopilot']),
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    autopilotInfo: app.getIn(['automation', 'autopilotInfo']),
    autopilotReady: app.getIn(['automation', 'autopilotReady']),
    autopilotUrl: app.getIn(['automation', 'autopilotUrl']),
    behavior: app.getIn(['automation', 'behavior']),
    behaviorMessages: app.getIn(['automation', 'behaviorMessages']),
    behaviorStats: app.getIn(['automation', 'behaviorStats']),
    browsers: app.getIn(['remoteBrowsers', 'browsers']),
    status: app.getIn(['automation', 'autopilotStatus']),
    open: app.getIn(['automation', 'autopilot']),
    url: app.getIn(['controls', 'url']),
    urlMethod: app.getIn(['controls', 'method'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleSidebar: b => dispatch(toggleAutopilotSidebar(b)),
    toggleAutopilot: (behavior, status, url) => dispatch(toggleAutopilot(behavior, status, url)),
    checkAvailability: url => dispatch(autopilotCheck(url)),
    autopilotReset: () => dispatch(autopilotReset())
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AutopilotUI);
