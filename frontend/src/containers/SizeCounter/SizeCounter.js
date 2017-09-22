import React from 'react';
import { connect } from 'react-redux';

import { SizeCounter } from 'components/controls';


const mapStateToProps = (state) => {
  const bytes = state.getIn(['sizeCounter', 'bytes']);
  return bytes ? { bytes } : {};
};

export default connect(
  mapStateToProps
)(SizeCounter);
