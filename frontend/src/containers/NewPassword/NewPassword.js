import React from 'react';
import { connect } from 'react-redux';

import { setNewPassword } from 'store/modules/passwordReset';
import { showModal } from 'store/modules/userLogin';

import { NewPasswordUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    error: app.getIn(['passwordReset', 'error']),
    success: app.getIn(['passwordReset', 'setNew'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setPassword: data => dispatch(setNewPassword(data)),
    toggleLogin: () => dispatch(showModal(true))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(NewPasswordUI);
