import React from 'react';
import { connect } from 'react-redux';

import { SizeCounter } from 'components/controls';


const mapStateToProps = ({ app }) => {
  const bytes = app.getIn(['sizeCounter', 'bytes']);
  return bytes ? { bytes } : {};
};

export default connect(
  mapStateToProps
)(SizeCounter);
