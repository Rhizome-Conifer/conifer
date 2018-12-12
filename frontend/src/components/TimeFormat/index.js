import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { buildDate, isoToDisplay } from 'helpers/utils';


class TimeFormat extends PureComponent {
  static propTypes = {
    classes: PropTypes.string,
    dt: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    iso: PropTypes.string,
    epoch: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    seconds: PropTypes.number,
    gmt: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = { displayTime: '' };
  }

  componentDidMount() {
    this.setState({ displayTime: this.renderTime() });
  }

  componentDidUpdate() {
    this.setState({ displayTime: this.renderTime() });
  }

  formatSeconds = (sec) => {
    if (sec < 60) {
      return `${sec}sec${sec !== 1 ? 's' : ''}`;
    }

    const display = [];
    let t = sec;

    const years = Math.floor(t / 31536000);
    if (years) {
      display.push(`${years}year${years !== 1 ? 's' : ''}`);
      t %= 31536000;
    }

    const months = Math.floor(t / 2592000);
    if (months) {
      display.push(`${months}month${months !== 1 ? 's' : ''}`);
      t %= 2592000;
    }

    const days = Math.floor(t / 86400);
    if (days) {
      display.push(`${days}day${days !== 1 ? 's' : ''}`);
      t %= 86400;
    }

    const hrs = Math.floor(t / 3600);
    if (hrs) {
      display.push(`${hrs}hr${hrs !== 1 ? 's' : ''}`);
      t %= 3600;
    }

    const min = Math.floor(t / 60);
    if (min) {
      display.push(`${min}min${min !== 1 ? 's' : ''}`);
    }

    return display.join(' ');
  }

  renderTime = () => {
    const { dt, epoch, gmt, iso, seconds } = this.props;

    let displayTime;
    if (iso) {
      displayTime = isoToDisplay(iso, gmt);
    } else if (typeof seconds !== 'undefined') {
      displayTime = this.formatSeconds(seconds);
    } else if (epoch) {
      displayTime = new Date(epoch * 1000).toLocaleString();
    } else {
      displayTime = buildDate(dt, gmt);
    }

    return displayTime;
  }

  render() {
    const { classes } = this.props;
    const { displayTime } = this.state;

    return (
      <span className={classes}>
        { displayTime }
      </span>
    );
  }
}

export default TimeFormat;
