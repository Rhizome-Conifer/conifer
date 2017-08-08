import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { reportBug } from 'redux/modules/bugReport';

import BugReportUI from 'components/BugReportUI';


class BugReport extends Component {

  submitReport = (data) => {
    this.props.sendBugReport(data);
  }

  render() {
    return (
      <BugReportUI submit={this.submitReport} />
    );
  }
}

const mapStateToProps = (state) => {
  return {};
};

const mapDispatchToProps = (dispatch) => {
  return {
    sendBugReport: data => dispatch(reportBug(data))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(BugReport);
