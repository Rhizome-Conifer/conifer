import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { UploadUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: app.getIn(['auth', 'activeCollection'])
  };
};


export default withRouter(connect(
  mapStateToProps
)(UploadUI));
