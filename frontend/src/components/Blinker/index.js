import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CSSTransitionGroup } from 'react-transition-group';


import './style.scss';
//<span onLoad={this.blinkAnimation()} className="glyphicon glyphicon-dot-sm glyphicon-recording-status Blink" aria-hidden="true" />

class Blinker extends Component {
  static propTypes = {
    dataPing: PropTypes.bool
  };

  constructor(props) {
    super(props);
    this.state = { blink: "meow" };
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.dataPing && !prevProps.dataPing) {
      this.setState({ blinking: true });
      // clear blink timeout if another request comes in before previous blink is done
      clearTimeout(this.blinkHandle);
      // blink anywhere from 500ms - 1.5s
      this.blinkHandle = setTimeout(() => this.setState({ blink: false }), (Math.random() * 1000) + 500);
    }
  }

  componentWillUnmount() {
    // make sure timer is cleared before unmounting
    clearTimeout(this.blinkHandle);
  }

  render() {
    return (
      <span className={classNames({ blink: this.state.blink }, "glyphicon glyphicon-dot-sm glyphicon-recording-status")} aria-hidden="true" />
    );
  }
}


export default Blinker;
