import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { login } from 'redux/modules/auth';
import { load as loadUser } from 'redux/modules/user';

import { UserManagementUI } from 'components/siteComponents';


const mapStateToProps = (state) => {
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
