import React from 'react';
import { connect } from 'react-redux';

import { checkUser, sendSignup } from 'redux/modules/userSignup';
import { UserSignup } from 'components/SiteComponents';


const mapStateToProps = (state) => {
  const { available, checkedUsername, errors,
          result, success, userCheck } = state.userSignup;

  return {
    available,
    checkedUsername,
    errors,
    result,
    success,
    userCheck
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
