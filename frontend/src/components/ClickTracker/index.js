import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactGA from 'react-ga';

import config from 'config';


class ClickTracker extends PureComponent {
  static propTypes = {
    children: PropTypes.node,
    inline: PropTypes.bool,
    category: PropTypes.string,
    action: PropTypes.string
  };

  static defaultProps = {
    category: 'User'
  };

  sendPing = () => {
    const { action, category } = this.props;
    ReactGA.event({ category, action });
  }

  render() {
    const { inline } = this.props;

    if (!config.gaId) {
      return this.props.children;
    }

    return (
      <div onClick={this.sendPing} style={inline ? { display: 'inline' } : {}}>
        {this.props.children}
      </div>
    );
  }
}

export default ClickTracker;
