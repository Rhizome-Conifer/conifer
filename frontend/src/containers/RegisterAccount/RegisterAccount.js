import React, { Component } from 'react';
import PropTypes from 'prop-types';


class RegisterAccount extends Component {

  static contextTypes = {
    router: PropTypes.object
  };

  static propTypes = {
    match: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = { error: false };
  }

  componentDidMount() {
    const { match } = this.props;
    const reg = match.params.registration;
    document.cookie = `valreg=${reg}; Max-Age=60; Path=/api/v1/userval`;

    const data = new FormData();
    data.append('reg', reg);

    // call user registration endpoint
    fetch('/api/v1/userval', {
      credentials: 'same-origin',
      method: 'POST',
      body: data
    }).then(res => res.json())
      .then((result) => {
        if (result.error) {
          this.setState({ error: true });
        }

        // redirect to homepage, disregard history
        window.location = '/';
      });
  }

  render() {
    const { error } = this.state;

    return (
      <React.Fragment>
        {
          error ?
            <React.Fragment>
              <h2>Error Validating Registration</h2>
              <p>Please try the link again or contact <a href="mailto:support@webrecorder.io">support@webrecorder.io</a> if the problem persists.</p>
            </React.Fragment> :
            <h2>Validating Registration...</h2>
        }
      </React.Fragment>
    );
  }
}

export default RegisterAccount;
