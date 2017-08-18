import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { BugIcon } from 'components/Icons';
import Modal from 'components/Modal';

import ReportBugForm from './forms';


class BugReportUI extends Component {
  static propTypes = {
    submit: PropTypes.func,
  };

  static contextTypes = {
    metadata: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = { showModal: false };
  }

  closeModal = () => {
    this.setState({ showModal: false });
  }

  showModal = () => {
    this.setState({ showModal: true });
  }

  submitWrapper = (data) => {
    this.props.submit(data);
    this.closeModal();
  }

  render() {
    const { showModal } = this.state;
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
          onClick={this.showModal}>
          <BugIcon />
        </button>
        <Modal
          header={reportHeader}
          visible={showModal}
          closeCb={this.closeModal}>
          <ReportBugForm cb={this.submitWrapper} />
        </Modal>
      </div>
    );
  }
}

export default BugReportUI;
