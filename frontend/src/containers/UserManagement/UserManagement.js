import React from 'react';
import { connect } from 'react-redux';

import { login } from 'redux/modules/auth';

import { UserManagementUI } from 'components/siteComponents';


const mapStateToProps = (outerState) => {
  const state = outerState.app;
  return {
    auth: state.get('auth')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    loginFn: data => dispatch(login(data))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserManagementUI);
