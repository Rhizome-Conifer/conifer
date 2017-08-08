import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Checkbox } from 'react-bootstrap';


export class CheckboxField extends Component {
  static propTypes = {
    cb: PropTypes.func,
    label: PropTypes.string,
    name: PropTypes.string
  };

  render() {
    const { cb, label, name } = this.props;

    return (
      <div>
        <Checkbox name={name} onChange={cb}>
          { label }
        </Checkbox>
      </div>
    );
  }
}

export default CheckboxField;
