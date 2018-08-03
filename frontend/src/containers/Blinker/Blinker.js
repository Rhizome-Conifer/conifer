import React from 'react';
import { connect } from 'react-redux';

import BlinkerUI from 'components/BlinkerUI';


const mapStateToProps = ({ app }) => {
  const bytes = app.getIn(['infoStats', 'pending_size']) || 0;
  return { bytes };
};

export default connect(
  mapStateToProps
)(BlinkerUI);
