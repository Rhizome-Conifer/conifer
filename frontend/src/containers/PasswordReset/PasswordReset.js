import React from 'react';
import { connect } from 'react-redux';

import { resetPassword } from 'store/modules/passwordReset';
import { PasswordResetUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    errors: app.getIn(['passwordReset', 'errors']),
    success: app.getIn(['passwordReset', 'reset'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cb: data => dispatch(resetPassword(data))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PasswordResetUI);
