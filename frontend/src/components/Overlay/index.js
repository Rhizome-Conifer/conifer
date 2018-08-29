import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';


class Overlay extends Component {
  static propTypes = {
    callback: PropTypes.func,
    children: PropTypes.node,
    placement: PropTypes.string,
    show: PropTypes.bool,
    target: PropTypes.func
  };

  static defaultProps = {
    placement: 'bottom'
  };

  componentDidMount() {
    this.el = document.createElement('div');
    this.el.classList.add('wr-overlay');
    document.querySelector('#portal').appendChild(this.el);
  }

  componentDidUpdate(lastProps) {
    const { target, placement } = this.props;

    if (this.props.show && !lastProps.show) {
      const bcr = target().getBoundingClientRect();

      const centerX = bcr.left + (bcr.width / 2);
      const centerY = bcr.top + (bcr.height / 2);

      let selfBcr = { width: 0, height: 0 };
      if (this.child.childNodes.length > 0) {
        selfBcr = this.child.childNodes[0].getBoundingClientRect();
      }

      switch(placement) {
        default:
        case 'bottom':
          this.el.style.left = `${centerX - (selfBcr.width / 2)}px`;
          this.el.style.top = `${bcr.bottom}px`;
          break;
        case 'left':
          this.el.style.left = `${bcr.left - selfBcr.width}px`;
          this.el.style.top = `${centerY - (selfBcr.height / 2)}px`;
          break;
        case 'right':
          this.el.style.left = `${bcr.right}px`;
          this.el.style.top = `${centerY - (selfBcr.height / 2)}px`;
          break;
        case 'top':
          this.el.style.left = `${centerX - (selfBcr.width / 2)}px`;
          this.el.style.top = `${bcr.top - selfBcr.height}px`;
          break;
      }
    }
  }

  componentWillUnmount() {
    document.querySelector('#portal').removeChild(this.el);
  }

  render() {
    if (!this.el || !this.props.show) {
      return null;
    }

    return ReactDOM.createPortal(
      <div ref={(obj) => { this.child = obj; }}>{this.props.children}</div>,
      this.el
    );
  }
}

export default Overlay;
