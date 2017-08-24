import React from 'react';
import { connect } from 'react-redux';

import { toggleToolBin } from 'redux/modules/toolBin';

import { RecordingToolsUI } from 'components/Controls';


const mapStateToProps = (state) => {
  const toolBin = state.get('toolBin');
  return {
    toolsOpen: toolBin.get('open')
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
