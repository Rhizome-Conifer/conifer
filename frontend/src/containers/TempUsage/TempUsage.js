import React from 'react';
import { connect } from 'react-redux';

import { showModal } from 'redux/modules/userLogin';

import { TempUsageUI } from 'components/siteComponents';


const mapStateToProps = ({ app }, ownProps) => {
  return {
    tempUser: app.getIn(['tempUser', 'user']),
    ...ownProps
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    hideModal: () => dispatch(showModal(false))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TempUsageUI);
