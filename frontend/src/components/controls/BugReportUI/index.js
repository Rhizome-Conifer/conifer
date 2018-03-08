import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { BugIcon } from 'components/icons';
import Modal from 'components/Modal';

import ReportBugForm from './forms';


class BugReportUI extends Component {
  static propTypes = {
    closeBugReport: PropTypes.func,
    openBugReport: PropTypes.func,
    showModal: PropTypes.bool,
    submit: PropTypes.func,
  };

  static contextTypes = {
    metadata: PropTypes.object
  }

  submitWrapper = (data) => {
    this.props.submit(data);
    this.props.closeBugReport();
  }

  render() {
    const { closeBugReport, showModal, openBugReport } = this.props;
    const { metadata } = this.context;

    const reportHeader = (
      <div>
        <h4>This Page Doesn't Look Right? Let Us Know!</h4>
        <p>{`Some pages are tricky for ${metadata.product} to capture and replay. Our goal is to make it work as best as possible on any page!`}</p>
        <p>{`Please indicate anything that may have gone wrong on this page. Your feedback will help make ${metadata.product} better!`}</p>
      </div>
    );

    return (
      <div>
        <button
          className="btn btn-default"
          title="Doesn't look right?"
          onClick={openBugReport}>
          <BugIcon />
        </button>
        <Modal
          header={reportHeader}
          visible={showModal}
          closeCb={closeBugReport}>
          <ReportBugForm cb={this.submitWrapper} />
        </Modal>
      </div>
    );
  }
}

export default BugReportUI;
