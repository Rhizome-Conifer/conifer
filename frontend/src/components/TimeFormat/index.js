import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { buildDate, isoToDisplay } from 'helpers/utils';


class TimeFormat extends Component {
  static propTypes = {
    classes: PropTypes.string,
    dt: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    iso: PropTypes.string,
    epoch: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    gmt: PropTypes.bool
  };

  static defaultProps = {
    dt: false,
    gmt: false
  };

  constructor(props) {
    super(props);

    this.state = { displayTime: '' };
  }

  componentDidMount() {
    const { dt, epoch, gmt, iso } = this.props;

    if (iso) {
      this.setState({ displayTime: isoToDisplay(iso, gmt) });
    } else {
      this.setState({ displayTime: buildDate(dt, epoch, gmt) });
    }
  }

  componentWillReceiveProps(nextProps) {
    if(nextProps.dt !== this.props.dt || nextProps.epoch !== this.props.epoch) {
      const { dt, epoch, gmt } = nextProps;
      this.setState({ displayTime: buildDate(dt, epoch, gmt) });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if(nextProps.dt !== this.props.dt || nextProps.epoch !== this.props.epoch ||
       nextState.displayTime !== this.state.displayTime)
      return true;

    return false;
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
