import React from 'react';
import { connect } from 'react-redux';

import { resetPassword } from 'redux/modules/passwordReset';
import { PasswordReset } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    errors: app.getIn(['passwordReset', 'errors'])
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
)(PasswordReset);
