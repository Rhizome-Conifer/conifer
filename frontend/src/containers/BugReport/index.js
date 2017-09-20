import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { closeModal, reportBug, showModal } from 'redux/modules/bugReport';

import { BugReportUI } from 'components/controls';


class BugReport extends Component {

  submitReport = (data) => {
    this.props.sendBugReport(data);
  }

  render() {
    const { closeBugReport, openBugReport, showModal } = this.props;

    return (
      <BugReportUI
        submit={this.submitReport}
        showModal={showModal}
        openBugReport={openBugReport}
        closeBugReport={closeBugReport} />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    showModal: state.getIn(['bugReport', 'showModal'])
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
)(BugReport);
