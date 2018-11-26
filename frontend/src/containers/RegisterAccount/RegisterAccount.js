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
      error: false,
      success: false,
      username: qs.username
    };
  }

  componentDidMount() {
    const { match } = this.props;
    const reg = match.params.registration;
    const validateApi = `${apiPath}/auth/validate`;
    document.cookie = `valreg=${reg}; Max-Age=60; Path=${validateApi}`;

    const data = { reg };

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
    const { error, success } = this.state;
    const finished = error || success;

    return (
      <div className="verification">
        {
          !finished &&
            <h3>Validating Registration...</h3>
        }
        {
          finished && error === 'invalid_code' &&
            <React.Fragment>
              <h3>Error Validating Registration</h3>
              <p>Please try the link again or contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a> if the problem persists.</p>
            </React.Fragment>
        }
        {
          finished && error === 'already_registered' &&
            <React.Fragment>
              <h3>This user has already been verified.</h3>
              <button onClick={this.props.toggleLogin} className="rounded">Login</button>
            </React.Fragment>
        }
        {
          finished && success &&
            <React.Fragment>
              <h3>Thank you {this.state.username}, your email is now verified.</h3>
              <button onClick={this.goHome} className="rounded">Proceed to Homepage</button>
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
