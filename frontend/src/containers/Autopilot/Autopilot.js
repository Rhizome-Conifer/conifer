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
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    behavior: app.getIn(['automation', 'behavior']),
    behaviorMessages: app.getIn(['automation', 'behaviorMessages']),
    behaviorStats: app.getIn(['automation', 'behaviorStats']),
    browsers: app.getIn(['remoteBrowsers', 'browsers']),
    autopilotReady: app.getIn(['automation', 'autopilotReady']),
    autopilotInfo: app.getIn(['automation', 'autopilotInfo']),
    autopilotUrl: app.getIn(['automation', 'autopilotUrl']),
    status: app.getIn(['automation', 'autopilotStatus']),
    open: app.getIn(['automation', 'autopilot']),
    url: app.getIn(['controls', 'url'])
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
