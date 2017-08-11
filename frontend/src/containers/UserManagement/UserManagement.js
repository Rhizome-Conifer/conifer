import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { login, logout } from 'redux/modules/auth';
import { load as loadUser } from 'redux/modules/user';

import { UserManagementUI } from 'components/SiteComponents';


class UserManagement extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.number,
    login: PropTypes.func,
    logout: PropTypes.func,
    loadUser: PropTypes.func,
    user: PropTypes.object
  }

  componentDidMount() {
    const { auth, user } = this.props;
    const shouldLoad = !auth.get('loading') &&
                        auth.get('user') &&
                        auth.getIn(['user', 'username']) &&
                       !user.get('loading');

    console.log('coll list should load', shouldLoad);
    // TODO: rethink, this causes a double render on first load
    if(shouldLoad)
      this.props.loadUser(auth.getIn(['user', 'username']));
  }

  componentWillReceiveProps(nextProps) {
    const { auth, user } = this.props;
    const shouldLoad = !auth.get('loading') &&
                        auth.get('user') &&
                        auth.getIn(['user', 'username']) &&
                       !user.get('loading') &&
                       !user.get('loaded');

    console.log('coll list should load', shouldLoad);
    // TODO: rethink, this causes a double render on first load
    if(shouldLoad)
      this.props.loadUser(auth.getIn(['user', 'username']));
  }

  logout = (evt) => {
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
        collCount={user.get('data') ? user.getIn(['data', 'collections']).size : 0}
        loginFn={this.login}
        logoutFn={this.logout} />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    auth: state.get('auth'),
    user: state.get('user')
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
