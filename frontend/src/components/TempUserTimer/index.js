import React, { Component } from 'react';
import PropTypes from 'prop-types';

class TempUserTimer extends Component {
  static propTypes = {
    accessed: PropTypes.number,
    ttl: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.timer = null;

    // ttl minus accessed offset
    const ttl = parseInt(props.ttl, 10) - parseInt((Date.now() - props.accessed) / 1000, 10);
    const min = Math.max(0, Math.floor(ttl / 60));
    const sec = ttl % 60;

    this.state = {
      min: String(min).padStart(2, '0'),
      sec: String(sec).padStart(2, '0'),
      ttl
    };
  }

  componentDidMount() {
    this.timer = setInterval(this.tick, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  tick = () => {
    const { ttl } = this.state;
    const min = Math.max(0, Math.floor(ttl / 60));
    const sec = ttl % 60;

    this.setState({
      min: String(min).padStart(2, '0'),
      sec: String(sec).padStart(2, '0'),
      ttl: ttl - 1
    });
  }

  render() {
    const { min, sec } = this.state;

    return (
      <span>{`${min} min, ${sec} sec`}</span>
    );
  }
}

export default TempUserTimer;
