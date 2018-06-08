import React from 'react';
import { connect } from 'react-redux';

import { set404 as set404Callback } from 'store/modules/controls';
import { showModal } from 'store/modules/userLogin';

import Temp404UI from 'components/Temp404UI';


const mapStateToProps = () => {
  return {};
};

const mapDispatchToProps = (dispatch) => {
  return {
    showLoginModal: () => dispatch(showModal(true)),
    set404: b => dispatch(set404Callback(b))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Temp404UI);
