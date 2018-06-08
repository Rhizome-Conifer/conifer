import React from 'react';
import { connect } from 'react-redux';

import { checkUser, sendSignup } from 'store/modules/userSignup';
import { UserSignup } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  const userSignup = app.get('userSignup');

  return {
    available: userSignup.get('available'),
    checkedUsername: userSignup.get('checkedUsername'),
    errors: userSignup.get('errors'),
    result: userSignup.get('result'),
    submitting: userSignup.get('submitting'),
    success: userSignup.get('success'),
    userCheck: userSignup.get('userCheck'),
    user: app.getIn(['auth', 'user'])
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
