import React, { Component } from 'react';
import PropTypes from 'prop-types';


class OutsideClick extends Component {
  /**
   * Wrapper component to manage whether clicks (or escape) occur outside
   * of component, calling handleClick if so. (e.g. clicks outside dropdown)
   */

  static propTypes = {
    children: PropTypes.node.isRequired,
    handleClick: PropTypes.func
  };

  componentDidMount() {
    window.wrAppContainer.addEventListener('mousedown', this.checkClick);
    window.wrAppContainer.addEventListener('keyup', this.checkKey);
  }

  componentWillUnmount() {
    window.wrAppContainer.removeEventListener('mousedown', this.checkClick);
    window.wrAppContainer.removeEventListener('keyup', this.checkKey);
  }

  checkKey = (evt) => {
    // escape key
    if(evt.keyCode === 27)
      this.props.handleClick(evt);
  }

  checkClick = (evt) => {
    if (!this.container.contains(evt.target) && this.props.handleClick) {
      this.props.handleClick(evt);
    }
  }

  render() {
    return (
      <div ref={(obj) => { this.container = obj; }}>
        { this.props.children }
      </div>
    );
  }
}

export default OutsideClick;
