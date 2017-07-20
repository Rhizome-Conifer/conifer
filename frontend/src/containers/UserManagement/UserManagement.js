import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { login, logout } from 'redux/modules/auth';
import { load as loadUser } from 'redux/modules/user';

import UserManagementUI from 'components/UserManagementUI';


class UserManagement extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.number,
    login: PropTypes.func,
    logout: PropTypes.func,
    loadUser: PropTypes.func
  }

  componentDidMount() {
    if(this.props.auth.user && !this.props.user.loading)
      this.props.loadUser(this.props.auth.user.username);
  }

  logout = (evt) => {
    evt.preventDefault();
    this.props.logout();
  }

  login = (data) => {
    this.props.login(data);
  }

  render() {
    const { auth, user } = this.props;

    return (
      <UserManagementUI
        auth={auth}
        collCount={user.data ? user.data.collections.length : 0}
        loginFn={this.login}
        logoutFn={this.logout} />
    );
  }
}

const mapStateToProps = (state) => {
  const { auth, user } = state;
  return {
    auth,
    user
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    login: data => dispatch(login(data)),
    logout: () => dispatch(logout()),
    loadUser: username => dispatch(loadUser(username))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserManagement);
