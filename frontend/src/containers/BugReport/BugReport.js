import React from 'react';
import { connect } from 'react-redux';

import { reportBug, toggleModal } from 'store/modules/bugReport';

import { BugReportUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    reportModal: app.getIn(['bugReport', 'reportModal'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    closeBugReport: () => dispatch(toggleModal(null)),
    sendBugReport: (data, reportType) => dispatch(reportBug(data, reportType))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(BugReportUI);
