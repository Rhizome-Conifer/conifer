import React from 'react';
import { connect } from 'react-redux';

import { getActiveRemoteBrowser } from 'redux/selectors';

import { ModeSelector } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    remoteBrowserSelected: getActiveRemoteBrowser(app)
  };
};

export default connect(
  mapStateToProps
)(ModeSelector);
