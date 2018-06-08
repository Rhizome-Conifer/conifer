import React from 'react';
import { connect } from 'react-redux';

import { reportBug, toggleModal } from 'store/modules/bugReport';

import { BugReportUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    showModal: app.getIn(['bugReport', 'dnlr'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    closeBugReport: () => dispatch(toggleModal(false)),
    openBugReport: () => dispatch(toggleModal(true)),
    sendBugReport: data => dispatch(reportBug(data))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(BugReportUI);
