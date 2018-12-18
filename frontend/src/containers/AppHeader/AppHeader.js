import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import AppHeaderUI from 'components/siteComponents/AppHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    is404: app.getIn(['controls', 'is404']),
    authUser: app.getIn(['auth', 'user'])
  };
};

export default withRouter(connect(
  mapStateToProps
)(AppHeaderUI));
