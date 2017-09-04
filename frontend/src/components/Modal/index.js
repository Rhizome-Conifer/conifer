import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal as BSModal } from 'react-bootstrap';


class Modal extends Component {

  static propTypes = {
    header: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    body: PropTypes.element,
    footer: PropTypes.element,
    visible: PropTypes.bool,
    closeCb: PropTypes.func
  }

  render() {
    const { body, children, closeCb, footer, header, visible } = this.props;

    return (
      <BSModal show={visible} onHide={closeCb}>
        { header &&
          <BSModal.Header closeButton>
            {
              typeof header === 'string' ?
                <BSModal.Title>{ header }</BSModal.Title> :
                header
            }
          </BSModal.Header>
        }
        <BSModal.Body>{ body || children }</BSModal.Body>
        {
          footer &&
            <BSModal.Footer>
              { footer }
            </BSModal.Footer>
        }
      </BSModal>
    );
  }
}

export default Modal;
