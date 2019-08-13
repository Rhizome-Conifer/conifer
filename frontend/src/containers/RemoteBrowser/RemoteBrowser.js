import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { RemoteBrowserUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  const remoteBrowsers = app.get('remoteBrowsers');
  return {
    behavior: app.getIn(['automation', 'behavior']),
    clipboard: app.getIn(['toolBin', 'clipboard']),
    contentFrameUpdate: app.getIn(['controls', 'contentFrameUpdate']),
    creating: remoteBrowsers.get('creating'),
    inactiveTime: remoteBrowsers.get('inactiveTime'),
    reqId: remoteBrowsers.get('reqId'),
    sidebarResize: app.getIn(['sidebar', 'resizing'])
  };
};

export default withRouter(connect(
  mapStateToProps
)(RemoteBrowserUI));
