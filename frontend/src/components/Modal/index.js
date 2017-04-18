import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal as BSModal } from 'react-bootstrap';


class Modal extends Component {

  static propTypes = {
    header: PropTypes.string,
    body: PropTypes.object,
    visible: PropTypes.bool,
    closeCb: PropTypes.func
  }

  render() {
    const { header, body, visible, closeCb } = this.props;

    return (
      <BSModal show={visible} onHide={closeCb}>
        <BSModal.Header closeButton>
          <BSModal.Title>{ header || 'Webrecorder' }</BSModal.Title>
        </BSModal.Header>
        <BSModal.Body>{ body }</BSModal.Body>
      </BSModal>
    );
  }
}

export default Modal;
