import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { login } from 'redux/modules/auth';
import { load as loadUser } from 'redux/modules/user';

import { UserManagementUI } from 'components/siteComponents';


class UserManagement extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.number,
    login: PropTypes.func
  }

  login = (data) => {
    this.props.login(data);
  }

  render() {
    const { auth } = this.props;

    return (
      <UserManagementUI
        auth={auth}
        loginFn={this.login} />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    auth: state.get('auth')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    login: data => dispatch(login(data))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserManagement);
