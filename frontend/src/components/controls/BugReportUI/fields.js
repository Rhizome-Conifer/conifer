import React from 'react';
import PropTypes from 'prop-types';

import { Checkbox } from 'react-bootstrap';


export function CheckboxField(props) {
  const { cb, label, name } = props;

  return (
    <div>
      <Checkbox name={name} onChange={cb}>
        { label }
      </Checkbox>
    </div>
  );
}

CheckboxField.propTypes = {
  cb: PropTypes.func,
  label: PropTypes.string,
  name: PropTypes.string
};
