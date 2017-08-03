import React, { Component } from 'react';
import PropTypes from 'prop-types';


class OutsideClick extends Component {
  /**
   * Wrapper component to manage whether clicks occur outside
   * of component, calling handleClick if so. (e.g. clicks outside dropdown)
   */

  static propTypes = {
    children: PropTypes.node.isRequired,
    handleClick: PropTypes.func
  };

  componentDidMount() {
    window.wrAppContainer.addEventListener('mousedown', this.checkClick);
  }

  componentWillUnmount() {
    window.wrAppContainer.removeEventListener('mousedown', this.checkClick);
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
