import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CSSTransitionGroup } from 'react-transition-group';


import './style.scss';

class Blinker extends Component {
  static propTypes = {
    dataPing: PropTypes.bool
  };

  constructor(props) {
    super(props);
    this.state = { blink: true };
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.dataPing && !prevProps.dataPing) {
      this.setState({ blinking: true });
      clearTimeout(this.blinkHandle);
      this.blinkHandle = setTimeout(() => this.setState({ blink: false }), (Math.random() * 1000) + 500);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.blinkHandle);
  }

  render() {
    return (
      <span className={classNames({ blink: this.state.blink }, "glyphicon glyphicon-dot-sm glyphicon-recording-status")} aria-hidden="true" />
    );
  }
}


export default Blinker;
