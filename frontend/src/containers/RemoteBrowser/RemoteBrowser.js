import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { RemoteBrowserUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  const remoteBrowsers = app.get('remoteBrowsers');
  return {
    autoscroll: app.getIn(['controls', 'autoscroll']),
    clipboard: app.getIn(['toolBin', 'clipboard']),
    contentFrameUpdate: app.getIn(['controls', 'contentFrameUpdate']),
    inactiveTime: remoteBrowsers.get('inactiveTime'),
    reqId: remoteBrowsers.get('reqId'),
    sidebarResize: app.getIn(['sidebar', 'resizing'])
  };
};

export default withRouter(connect(
  mapStateToProps
)(RemoteBrowserUI));
