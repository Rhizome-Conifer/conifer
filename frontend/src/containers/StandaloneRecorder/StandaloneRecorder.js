import React from 'react';
import { connect } from 'react-redux';

import { StandaloneRecorderUI } from 'components/Controls';


const mapStateToProps = (state) => {
  const controls = state.get('controls');

  return {
    extractable: controls.get('extractable')
  };
};

export default connect(
  mapStateToProps
)(StandaloneRecorderUI);
