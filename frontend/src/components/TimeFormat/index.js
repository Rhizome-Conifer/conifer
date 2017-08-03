import React, { Component } from 'react';
import PropTypes from 'prop-types';

class TimeFormat extends Component {
  static propTypes = {
    dt: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    epoch: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    gmt: PropTypes.bool
  };

  static defaultProps = {
    dt: false,
    gmt: false,
  };

  constructor(props) {
    super(props);

    this.state = { displayTime: '' };
  }

  componentDidMount() {
    const { dt, epoch, gmt } = this.props;
    let displayTime;

    if(dt) {
      let DTString = String(dt);

      if(DTString.length < 14)
        DTString += '10000101000000'.substr(DTString.length);

      const datestr = (DTString.substring(0, 4) + '-' +
                    DTString.substring(4, 6) + '-' +
                    DTString.substring(6, 8) + 'T' +
                    DTString.substring(8, 10) + ':' +
                    DTString.substring(10, 12) + ':' +
                    DTString.substring(12, 14) + '-00:00');

      const date = new Date(datestr);
      if(gmt) {
        displayTime = date.toGMTString();
      } else {
        displayTime = date.toLocaleString();
      }
    } else if(epoch) {
      displayTime = new Date(epoch * 1000).toLocaleString();
    }

    this.setState({ displayTime });
  }

  render() {
    const { displayTime } = this.state;
    return (
      <span>
        { displayTime }
      </span>
    );
  }
}

export default TimeFormat;
