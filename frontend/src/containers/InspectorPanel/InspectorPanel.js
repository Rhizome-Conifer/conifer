import React from 'react';
import { connect } from 'react-redux';

import InspectorPanelUI from 'components/collection/InspectorPanelUI';


const mapStateToProps = ({ app }) => {
  return {
  };
};

export default connect(
  mapStateToProps
)(InspectorPanelUI);
