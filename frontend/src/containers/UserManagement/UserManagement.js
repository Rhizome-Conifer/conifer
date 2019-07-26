import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { load, login } from 'store/modules/auth';
import { toggleModal } from 'store/modules/bugReport';
import { showModal } from 'store/modules/userLogin';

import { UserManagementUI } from 'components/siteComponents';


const mapStateToProps = ({ app }) => {
  return {
    anonCTA: app.getIn(['userLogin', 'anonCTA']),
    auth: app.get('auth'),
    next: app.getIn(['userLogin', 'next']),
    open: app.getIn(['userLogin', 'open']),
    reportModal: app.getIn(['bugReport', 'reportModal'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    loadAuth: () => dispatch(load()),
    loginFn: data => dispatch(login(data)),
    showModal: b => dispatch(showModal(b)),
    toggleBugModal: b => dispatch(toggleModal(b, 'ui'))
  };
};


export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(UserManagementUI));
