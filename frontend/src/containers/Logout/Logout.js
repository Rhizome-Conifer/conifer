import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { logout as doLogout } from 'store/modules/auth';


class Logout extends Component {
  static contextTypes = {
    router: PropTypes.object,
  };

  static propTypes = {
    logout: PropTypes.func,
    loggingOut: PropTypes.bool
  }

  componentWillMount() {
    this.props.logout();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.loggingOut && !nextProps.loggingOut) {
      window.location = '/';
    }
  }

  render() {
    return null;
  }
}

const mapStateToProps = ({ app }) => {
  return {
    loggingOut: app.getIn(['auth', 'loggingOut'])
  };
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
