import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactGA from 'react-ga';


class Analytics extends PureComponent {
  static propTypes = {
    pathname: PropTypes.string
  };

  componentDidMount() {
    this.sendPing();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.pathname !== this.props.pathname) {
      this.sendPing();
    }
  }

  sendPing = () => {
    const { pathname } = this.props;
    ReactGA.set({ page: pathname });
    ReactGA.pageview(pathname);
  }

  render() {
    return null;
  }
}

export default Analytics;
