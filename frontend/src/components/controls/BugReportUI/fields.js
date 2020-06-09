import React from 'react';
import PropTypes from 'prop-types';

import { Form } from 'react-bootstrap';


export function CheckboxField(props) {
  const { cb, label, name } = props;

  return (
    <Form.Check type="checkbox" name={name} onChange={cb}>
      { label }
    </Form.Check>
  );
}

CheckboxField.propTypes = {
  cb: PropTypes.func,
  label: PropTypes.string,
  name: PropTypes.string
};
