import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { login } from 'redux/modules/auth';
import { showModal } from 'redux/modules/userLogin';

import { UserManagementUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    anonCTA: app.getIn(['userLogin', 'anonCTA']),
    auth: app.get('auth'),
    open: app.getIn(['userLogin', 'open'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    loginFn: data => dispatch(login(data)),
    showModal: b => dispatch(showModal(b))
  };
};


export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(UserManagementUI));
