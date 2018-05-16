import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';


class Overlay extends Component {
  static propTypes = {
    children: PropTypes.node,
    show: PropTypes.bool,
    target: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.el = document.createElement('div');
    this.el.classList.add('wr-overlay');
  }

  componentDidMount() {
    document.querySelector('#portal').appendChild(this.el);

    const target = this.props.target();
    const bcr = target.getBoundingClientRect();
    console.log(bcr);
    this.el.style.left = `${bcr.left}px`;
    this.el.style.top = `${bcr.bottom}px`;
  }

  render() {
    return ReactDOM.createPortal(
      this.props.show && this.props.children,
      this.el
    );
  }
}

export default Overlay;
