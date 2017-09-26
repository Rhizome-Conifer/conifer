import React from 'react';
import { connect } from 'react-redux';

import { RemoteBrowserUI } from 'components/controls';


const mapStateToProps = (state) => {
  const remoteBrowsers = state.get('remoteBrowsers');
  return {
    reqId: remoteBrowsers.get('reqId')
  };
};

export default connect(
  mapStateToProps
)(RemoteBrowserUI);
