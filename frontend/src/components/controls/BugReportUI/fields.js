import React from 'react';
import PropTypes from 'prop-types';

import { Form } from 'react-bootstrap';


export function CheckboxField(props) {
  const { cb, label, name } = props;

  return (
    <Form.Check type="checkbox" id={name} name={name} onChange={cb} label={label} />
  );
}

CheckboxField.propTypes = {
  cb: PropTypes.func,
  label: PropTypes.string,
  name: PropTypes.string
};
