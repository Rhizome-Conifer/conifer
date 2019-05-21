import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { login } from 'store/modules/auth';
import { assignNext } from 'store/modules/userLogin';

import LoginUI from 'components/LoginUI';


const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    assignNext: next => dispatch(assignNext(next)),
    loginFn: data => dispatch(login(data))
  };
};


export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(LoginUI));
