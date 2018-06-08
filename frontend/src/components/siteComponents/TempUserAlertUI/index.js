import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { inStorage, getStorage, setStorage } from 'helpers/utils';

import TempUserTimer from 'components/TempUserTimer';

import './style.scss';


class TempUserAlertUI extends PureComponent {
  static propTypes = {
    auth: PropTypes.object,
    showLoginModal: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      show: true
    };
  }

  componentDidMount() {
    if (inStorage('tempNotify', window.sessionStorage)) {
      try {
        const show = JSON.parse(getStorage('tempNotify', window.sessionStorage));
        this.setState({ show });
      } catch (e) {
        console.log('Wrong `tempNotify` storage value.', e);
      }
    }
  }

  hide = () => {
    this.setState({ show: false });
    setStorage('tempNotify', false, window.sessionStorage);
  }

  render() {
    const { auth, showLoginModal } = this.props;

    if (!this.state.show || !auth.get('user')) {
      return null;
    }

    return (
      <Alert className="temp-user-alert" onDismiss={this.hide}>
        Note: This collection is accessible only to you and will expire in <strong><TempUserTimer ttl={auth.getIn(['user', 'ttl'])} accessed={auth.get('accessed')} /></strong><br />
        To create permanent, shareable collections <Link to="/_register"><strong>Sign Up</strong></Link> or <button className="button-link" onClick={showLoginModal} type="button">Login</button>
      </Alert>
    );
  }
}

export default TempUserAlertUI;
