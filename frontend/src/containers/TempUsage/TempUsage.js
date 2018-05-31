import React from 'react';
import { connect } from 'react-redux';

import { showModal } from 'redux/modules/userLogin';
import { load } from 'redux/modules/tempUser';

import { TempUsageUI } from 'components/siteComponents';


const mapStateToProps = ({ app }, ownProps) => {
  return {
    tempUser: app.getIn(['tempUser', 'user']),
    ...ownProps
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    hideModal: () => dispatch(showModal(false)),
    loadUsage: u => dispatch(load(u))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TempUsageUI);
