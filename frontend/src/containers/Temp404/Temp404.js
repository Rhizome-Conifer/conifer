import React from 'react';
import { connect } from 'react-redux';

import { showModal } from 'redux/modules/userLogin';

import Temp404UI from 'components/Temp404UI';


const mapStateToProps = () => {
  return {};
};

const mapDispatchToProps = (dispatch) => {
  return {
    showLoginModal: () => dispatch(showModal(true))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Temp404UI);
