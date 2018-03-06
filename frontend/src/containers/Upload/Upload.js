import React, { Component } from 'react';
import { connect } from 'react-redux';

import { UploadUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: app.getIn(['user', 'activeCollection'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {

  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UploadUI);
