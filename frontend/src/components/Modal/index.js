import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Modal as ReactOverlayModal } from 'react-overlays';
import { Modal as BSModal } from 'react-bootstrap';


const focus = () => {};
const cDU = ReactOverlayModal.prototype.componentDidUpdate;
const cDM = ReactOverlayModal.prototype.componentDidMount;

ReactOverlayModal.prototype.componentDidUpdate = function (prevProps: any) {
  if (this.focus !== focus) {
    this.focus = focus;
  }
  cDU.call(this, prevProps);
};

ReactOverlayModal.prototype.componentDidMount = function () {
  if (this.focus !== focus) {
    this.focus = focus;
  }
  cDM.call(this);
};


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
