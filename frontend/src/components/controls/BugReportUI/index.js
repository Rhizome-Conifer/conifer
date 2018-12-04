import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { product } from 'config';

import { BugIcon } from 'components/icons';
import Modal from 'components/Modal';

import ReportBugForm from './forms';


class BugReportUI extends Component {
  static propTypes = {
    closeBugReport: PropTypes.func,
    openBugReport: PropTypes.func,
    showModal: PropTypes.bool,
    sendBugReport: PropTypes.func,
  };

  submitWrapper = (data) => {
    this.props.sendBugReport(data);
    this.props.closeBugReport();
  }

  render() {
    const { closeBugReport, showModal, openBugReport } = this.props;

    const reportHeader = (
      <React.Fragment>
        <h4>This Page Doesn't Look Right? Let Us Know!</h4>
        <p>{`Some pages are tricky for ${product} to capture and replay. Our goal is to make it work as best as possible on any page!`}</p>
        <p>{`Please indicate anything that may have gone wrong on this page. Your feedback will help make ${product} better!`}</p>
      </React.Fragment>
    );

    return (
      <React.Fragment>
        <button
          className="btn btn-default"
          title="Doesn't look right?"
          onClick={openBugReport}
          type="button">
          <BugIcon />
        </button>
        <Modal
          header={reportHeader}
          visible={showModal}
          closeCb={closeBugReport}>
          <ReportBugForm cb={this.submitWrapper} />
        </Modal>
      </React.Fragment>
    );
  }
}

export default BugReportUI;
