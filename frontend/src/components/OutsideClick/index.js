import React, { Component } from 'react';
import PropTypes from 'prop-types';


class OutsideClick extends Component {
  /**
   * Wrapper component to manage whether clicks (or escape) occur outside
   * of component, calling handleClick if so. (e.g. clicks outside dropdown)
   */

  static propTypes = {
    children: PropTypes.node.isRequired,
    classes: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    handleClick: PropTypes.func,
    inlineBlock: PropTypes.bool
  };

  componentDidMount() {
    document.addEventListener('mousedown', this.checkClick);
    document.addEventListener('keyup', this.checkKey);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.checkClick);
    document.removeEventListener('keyup', this.checkKey);
  }

  checkKey = (evt) => {
    // escape key
    if (evt.keyCode === 27)
      this.props.handleClick(evt);
  }

  checkClick = (evt) => {
    if (this.container && !this.container.contains(evt.target) && this.props.handleClick) {
      this.props.handleClick(evt);
    }
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
