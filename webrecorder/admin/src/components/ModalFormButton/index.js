import React, { Component, PropTypes } from 'react';
import { Button } from 'react-bootstrap';


class ModalFormButton extends Component {
  /**
   * extends Bootstrap's Button component
   * adds form binding.. passing the the form to the parent's `onClick` callback
   */

  static propTypes = {
    formData: PropTypes.object,
  }

  constructor(props) {
    super(props);

    this._click = this._click.bind(this);
  }

  _click(evt) {
    this.props.onClick(evt, this.props.form);
  }

  render() {
    return (
      <Button {...this.props} onClick={this._click} />
    );
  }
}

export default ModalFormButton;
