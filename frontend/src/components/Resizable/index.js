import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { inStorage, getStorage, setStorage } from 'helpers/utils';

import './style.scss';


class Resizable extends Component {
  static propTypes = {
    classes: PropTypes.string,
    resizeState: PropTypes.func,
    overrideWidth: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.number,
      PropTypes.string
    ]),
    storageKey: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = {
      width: 300,
      xPos: null
    };
  }

  componentDidMount() {
    const { storageKey } = this.props;
    let { width } = this.state;
    if (inStorage(storageKey || 'userSidebarWidth')) {
      try {
        width = JSON.parse(getStorage(storageKey || 'userSidebarWidth'));
        this.setState({ width });
      } catch (e) {
        console.log('Error retrieving width', e);
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this._sidebarPosition);
  }

  _startResize = (evt) => {
    this.setState({
      xPos: evt.clientX
    });

    if (this.props.resizeState) {
      this.props.resizeState(true);
    }

    document.addEventListener('mousemove', this._sidebarPosition);
    document.addEventListener('mouseup', this._endResize, { once: true });
  }

  _sidebarPosition = (evt) => {
    requestAnimationFrame(() => {
      const curX = evt.clientX;
      if (curX !== this.state.width) {
        const width = Math.max(window.innerWidth * 0.1, Math.min(window.innerWidth * 0.75, curX));
        this.setState({ width });
      }
    });
  }

  _endResize = () => {
    const { storageKey } = this.props;
    document.removeEventListener('mousemove', this._sidebarPosition);

    if (this.props.resizeState) {
      this.props.resizeState(false);
    }

    setStorage((storageKey || 'userSidebarWidth'), this.state.width);
    this.setState({ xPos: null });
  }

  render() {
    const { classes, overrideWidth } = this.props;
    const { width } = this.state;

    return (
      <aside
        className={classes}
        style={{ width: overrideWidth || width }}>
        {this.props.children}
        <div className="resizable-handle" onMouseDown={this._startResize} />
      </aside>
    );
  }
}

export default Resizable;
