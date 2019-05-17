import React, { Component } from 'react';
import PropTypes from 'prop-types';

import Modal from 'components/Modal';

import { ReportContentBugForm, ReportUIBugForm } from './forms';


class BugReportUI extends Component {
  static propTypes = {
    closeBugReport: PropTypes.func,
    reportModal: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object
    ]),
    route: PropTypes.object,
    sendBugReport: PropTypes.func,
  };

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.reportModal !== null) {
      return {
        type: nextProps.reportModal
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.state = {
      type: ''
    };
  }

  submitWrapper = (data) => {
    this.props.sendBugReport(data, this.props.reportModal);
    this.props.closeBugReport();
  }

  render() {
    const { closeBugReport, reportModal } = this.props;

    return (
      <Modal
        header="Submit a Bug Report"
        visible={reportModal !== null}
        closeCb={closeBugReport}>
        {
          this.state.type === 'ui' ?
            <ReportUIBugForm cb={this.submitWrapper} /> :
            <ReportContentBugForm route={this.props.route} cb={this.submitWrapper} />
        }
      </Modal>
    );
  }
}

export default BugReportUI;
