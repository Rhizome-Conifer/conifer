import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { logout as doLogout } from 'redux/modules/auth';


class Logout extends Component {
  static contextTypes = {
    router: PropTypes.object,
  };

  static propTypes = {
    logout: PropTypes.func
  }

  componentWillMount() {
    console.log('running logout');
    this.props.logout();
    this.context.router.replace('/');
  }

  render() {
    return null;
  }
}

const mapStateToProps = (state) => {
  return {};
};

const mapDispatchToProps = (dispatch) => {
  return {
    logout: () => dispatch(doLogout()),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Logout);
