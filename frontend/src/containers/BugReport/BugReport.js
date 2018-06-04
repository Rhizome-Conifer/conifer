import React from 'react';
import { connect } from 'react-redux';

import { closeModal, reportBug, showModal } from 'redux/modules/bugReport';

import { BugReportUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    showModal: app.getIn(['bugReport', 'showModal'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    closeBugReport: () => dispatch(closeModal()),
    openBugReport: () => dispatch(showModal()),
    sendBugReport: data => dispatch(reportBug(data))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(BugReportUI);
