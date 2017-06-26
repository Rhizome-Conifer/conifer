import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { login, logout } from 'redux/modules/auth';

import UserManagementUI from 'components/UserManagementUI';


class UserManagement extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.array,
    login: PropTypes.func,
    logout: PropTypes.func
  }

  logout = (evt) => {
    evt.preventDefault();
    this.props.logout();
  }

  login = (data) => {
    this.props.login(data);
  }

  render() {
    const { auth, collections } = this.props;

    return (
      <UserManagementUI
        auth={auth}
        collCount={collections ? collections.length : 0}
        loginFn={this.login}
        logoutFn={this.logout} />
    );
  }
}

const mapStateToProps = (state) => {
  const { auth, user } = state;
  return {
    auth,
    collections: user.data.collections,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    logout: () => dispatch(logout()),
    login: data => dispatch(login(data))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(UserManagement);
