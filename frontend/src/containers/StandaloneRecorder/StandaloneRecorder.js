import React from 'react';
import { connect } from 'react-redux';

import { getActiveRemoteBrowser } from 'redux/selectors';

import { StandaloneRecorderUI } from 'components/controls';


const mapStateToProps = (state) => {
  const controls = state.get('controls');
  const user = state.get('user');

  return {
    activeCollection: user.get('activeCollection'),
    extractable: controls.get('extractable'),
    remoteBrowserSelected: getActiveRemoteBrowser(state),
    username: user.get('username')
  };
};

export default connect(
  mapStateToProps
)(StandaloneRecorderUI);
