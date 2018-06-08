import React from 'react';
import { connect } from 'react-redux';

import { showModal } from 'store/modules/userLogin';

import { TempUserAlertUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    showLoginModal: () => dispatch(showModal(true))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TempUserAlertUI);
