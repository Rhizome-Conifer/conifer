import React, { Component } from 'react';
import PropTypes from 'prop-types';
import querystring from 'querystring';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { apiPath, supportEmail } from 'config';
import { apiFetch } from 'helpers/utils';

import { showModal } from 'store/modules/userLogin';

import './style.scss';


class RegisterAccount extends Component {

  static contextTypes = {
    router: PropTypes.object
  };

  static propTypes = {
    history: PropTypes.object,
    location: PropTypes.object,
    match: PropTypes.object,
    toggleLogin: PropTypes.func
  };

  constructor(props) {
    super(props);
    const qs = querystring.parse(props.location.search.replace('?', ''));

    this.state = {
      submitted: false,
      error: false,
      success: false,
      username: qs.username
    };
  }

  finalizeRegistration = () => {
    const { match } = this.props;
    const reg = match.params.registration;
    const validateApi = `${apiPath}/auth/validate`;
    document.cookie = `valreg=${reg}; Max-Age=60; Path=${validateApi}`;

    const data = { reg };

    this.setState({ submitted: true });

    // call user registration endpoint
    apiFetch(`/auth/validate?username=${this.state.username}`, data, { method: 'POST' })
      .then(res => res.json())
      .then((result) => {
        if (result.error) {
          this.setState({ error: result.error });
        } else {
          this.setState({ success: true });
        }
      });
  }

  goHome = () => {
    this.props.history.replace('/');
  }

  render() {
    const { error, submitted, success } = this.state;
    const finished = error || success;

    return (
      <div className="verification">
        {
          !submitted &&
            <React.Fragment>
              <h4>Please click the button to complete your registration:</h4>
              <button className="rounded btn-primary" onClick={this.finalizeRegistration} type="button">Complete Registration</button>
            </React.Fragment>
        }
        {
          submitted && !finished &&
            <h4>Validating Registration...</h4>
        }
        {
          finished && error === 'invalid_code' &&
            <React.Fragment>
              <h4>Error Validating Registration</h4>
              <p>Please try the link again or contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a> if the problem persists.</p>
            </React.Fragment>
        }
        {
          finished && error === 'already_registered' &&
            <React.Fragment>
              <h4>This user has already been verified.</h4>
              <button onClick={this.props.toggleLogin} className="rounded" type="button">Login</button>
            </React.Fragment>
        }
        {
          finished && success &&
            <React.Fragment>
              <h4>Thank you {this.state.username}, your email is now verified.</h4>
              <button onClick={this.goHome} className="rounded" type="button">Proceed to Homepage</button>
            </React.Fragment>
        }
      </div>
    );
  }
}


const mapDispatchToProps = (dispatch) => {
  return {
    toggleLogin: () => dispatch(showModal(true, false))
  };
};


export default withRouter(connect(
  () => ({}),
  mapDispatchToProps
)(RegisterAccount));
