import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { logout as doLogout } from 'store/modules/auth';


class Logout extends Component {
  static propTypes = {
    logout: PropTypes.func,
    loggingOut: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.props.logout();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.loggingOut && !this.props.loggingOut) {
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
