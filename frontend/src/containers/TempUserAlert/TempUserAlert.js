import React from 'react';
import { connect } from 'react-redux';

import { showModal } from 'redux/modules/userLogin';

import { TempUserAlertUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    tempUser: app.getIn(['tempUser', 'user'])
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
