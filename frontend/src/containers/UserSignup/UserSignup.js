import React from 'react';
import { connect } from 'react-redux';

import { checkUser, sendSignup } from 'redux/modules/userSignup';
import { UserSignup } from 'components/siteComponents';


const mapStateToProps = (state) => {
  const userSignup = state.get('userSignup');

  return {
    available: userSignup.get('available'),
    checkedUsername: userSignup.get('checkedUsername'),
    errors: userSignup.get('errors'),
    result: userSignup.get('result'),
    success: userSignup.get('success'),
    userCheck: userSignup.get('userCheck')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cb: data => dispatch(sendSignup(data)),
    checkUser: username => dispatch(checkUser(username))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserSignup);
