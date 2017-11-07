import React from 'react';
import { connect } from 'react-redux';

import { RemoteBrowserUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  const remoteBrowsers = app.get('remoteBrowsers');
  return {
    inactiveTime: remoteBrowsers.get('inactiveTime'),
    reqId: remoteBrowsers.get('reqId'),
  };
};

export default connect(
  mapStateToProps
)(RemoteBrowserUI);
