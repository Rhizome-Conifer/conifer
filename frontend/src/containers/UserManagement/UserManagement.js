import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { login, logout } from 'redux/modules/auth';
import { isLoaded as isUserLoaded,
         load as loadUser } from 'redux/modules/user';

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
      <UserManagementUI auth={auth} collCount={collections ? collections.length : 0} loginFn={this.login} logoutFn={this.logout} />
    );
  }
}

const preloadData = [
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      const promises = [];
      const { auth } = getState();

      if(!isUserLoaded(getState()) && auth.user.username)
        return dispatch(loadUser(auth.user.username));

      return Promise.all(promises);
    }
  }
];


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


export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps,
)(UserManagement);
