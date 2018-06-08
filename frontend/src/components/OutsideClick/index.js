import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { throttle } from 'helpers/utils';


class OutsideClick extends Component {
  /**
   * Wrapper component to manage whether clicks (or escape) occur outside
   * of component, calling handleClick if so. (e.g. clicks outside dropdown)
   */

  static propTypes = {
    children: PropTypes.node.isRequired,
    classes: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    disabled: PropTypes.bool,
    handleClick: PropTypes.func,
    inlineBlock: PropTypes.bool,
    scrollCheck: PropTypes.string
  };

  static defaultProps = {
    disabled: false
  };

  constructor(props) {
    super(props);

    // create throttled scroll check
    if (props.handleClick && props.scrollCheck) {
      this.throttledCB = throttle(props.handleClick, 300);
    }
  }

  componentDidMount() {
    if (!this.props.disabled) {
      this.bindListeners();
    }
  }

  componentDidUpdate(prevProps) {
    if (!this.props.disabled && prevProps.disabled) {
      this.bindListeners();
    } else if (this.props.disabled && !prevProps.disabled) {
      this.removeListeners();
    }
  }

  componentWillUnmount() {
    if (!this.props.disabled) {
      this.removeListeners();
    }
  }

  bindListeners = () => {
    document.addEventListener('click', this.checkClick, false);
    document.addEventListener('keyup', this.checkKey);

    if (this.props.handleClick && this.props.scrollCheck && document.querySelector(this.props.scrollCheck)) {
      document.querySelector(this.props.scrollCheck).addEventListener('scroll', this.handleScroll);
    }
  }

  removeListeners = () => {
    document.removeEventListener('click', this.checkClick, false);
    document.removeEventListener('keyup', this.checkKey);

    if (this.props.handleClick && this.props.scrollCheck && document.querySelector(this.props.scrollCheck)) {
      document.querySelector(this.props.scrollCheck).removeEventListener('scroll', this.handleScroll);
    }
  }

  checkKey = (evt) => {
    // escape key
    if (evt.keyCode === 27) {
      this.props.handleClick(evt);
    }
  }

  checkClick = (evt) => {
    if (this.container && !this.container.contains(evt.target) && this.props.handleClick) {
      this.props.handleClick(evt);
    }
  }

  handleScroll = () => {
    requestAnimationFrame(this.throttledCB);
  }

  render() {
    const { classes, inlineBlock } = this.props;

    return (
      <div className={classes} ref={(obj) => { this.container = obj; }} style={inlineBlock ? { display: 'inline-block' } : {}}>
        { this.props.children }
      </div>
    );
  }
}

export default OutsideClick;
