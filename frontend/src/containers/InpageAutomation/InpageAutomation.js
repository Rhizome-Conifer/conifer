import React from 'react';
import { connect } from 'react-redux';

import { toggleInpageSidebar } from 'store/modules/automation';

import { InpageAutomationUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    running: app.getIn(['automation', 'inpageRunning']),
    open: app.getIn(['automation', 'inpageAutomation'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleInpageAutomation: b => dispatch(toggleInpageSidebar(b))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InpageAutomationUI);
