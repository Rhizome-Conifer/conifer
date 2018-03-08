import React from 'react';
import { connect } from 'react-redux';

import { toggleToolBin } from 'redux/modules/toolBin';

import { RecordingToolsUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    toolsOpen: app.getIn(['toolBin', 'open'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleTools: b => dispatch(toggleToolBin(b))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RecordingToolsUI);
