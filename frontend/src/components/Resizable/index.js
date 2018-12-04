import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { dispatchEvent, inStorage, getStorage, setStorage } from 'helpers/utils';

import './style.scss';


class Resizable extends Component {
  static propTypes = {
    axis: PropTypes.oneOf(['x', 'y']),
    children: PropTypes.node,
    classes: PropTypes.string,
    flexGrow: PropTypes.number,
    maxHeight: PropTypes.number,
    maxWidth: PropTypes.number,
    minHeight: PropTypes.number,
    minWidth: PropTypes.number,
    overrideWidth: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.number,
      PropTypes.string
    ]),
    overrideHeight: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.number,
      PropTypes.string
    ]),
    resizeState: PropTypes.func,
    storageKey: PropTypes.string
  };

  static defaultProps = {
    axis: 'x',
  };

  constructor(props) {
    super(props);

    this.state = {
      hasResized: false,
      height: 400,
      width: 300
    };
  }

  componentDidMount() {
    const { axis, storageKey, minWidth, maxWidth, minHeight, maxHeight } = this.props;

    if (inStorage(storageKey || 'userSidebarWidth')) {
      try {
        if (axis === 'x') {
          const { width } = JSON.parse(getStorage(storageKey || 'userSidebarWidth'));
          this.setState({ width: width || this.state.width, hasResized: typeof width !== 'undefined' });
        } else {
          const { height } = JSON.parse(getStorage(storageKey || 'userSidebarWidth'));
          this.setState({ height: height || this.state.height, hasResized: typeof height !== 'undefined' });
        }
      } catch (e) {
        console.log('Error retrieving width', e);
      }
    }

    const bcr = this.container.parentNode.getBoundingClientRect();
    this.minWidth = minWidth || window.innerWidth * 0.1;
    this.maxWidth = maxWidth || window.innerWidth * 0.75;
    this.minHeight = minHeight || bcr.height * 0.25;
    this.maxHeight = maxHeight || bcr.height * 0.75;
  }

  componentWillUnmount() {
    if (this.props.axis === 'x') {
      document.removeEventListener('mousemove', this._sidebarPositionX);
    } else {
      document.removeEventListener('mousemove', this._sidebarPositionY);
    }

    if (this.handle) {
      clearTimeout(this.handle);
    }
  }

  _startResize = () => {
    const { axis, maxHeight, minHeight } = this.props;

    if (this.props.resizeState) {
      this.props.resizeState(true);
    }

    // grab container offset before initiating resize
    const bcr = this.container.parentNode.getBoundingClientRect();
    this.containerOffset = axis === 'x' ? bcr.left : bcr.top;

    if (axis === 'x') {
      document.addEventListener('mousemove', this._sidebarPositionX);
    } else {
      // recalc max heights
      this.minHeight = minHeight || bcr.height * 0.25;
      this.maxHeight = maxHeight || bcr.height * 0.75;
      document.addEventListener('mousemove', this._sidebarPositionY);
    }
    document.addEventListener('mouseup', this._endResize, { once: true });

    this.setState({ hasResized: true });
  }

  _sidebarPositionX = (evt) => {
    requestAnimationFrame(() => {
      const curX = evt.clientX;
      if (curX !== this.state.width) {
        const width = Math.max(this.minWidth, Math.min(this.maxWidth, (curX - this.containerOffset)));
        this.setState({ width });
      }
    });
  }

  _sidebarPositionY = (evt) => {
    requestAnimationFrame(() => {
      const curY = evt.clientY;
      if (curY !== this.state.height) {
        const height = Math.max(this.minHeight, Math.min(this.maxHeight, (curY - this.containerOffset)));
        this.setState({ height });
      }
    });
  }

  _endResize = () => {
    const { storageKey } = this.props;
    const { width, height } = this.state;

    if (this.props.axis === 'x') {
      document.removeEventListener('mousemove', this._sidebarPositionX);
    } else {
      document.removeEventListener('mousemove', this._sidebarPositionY);
    }

    if (this.props.resizeState) {
      this.props.resizeState(false);
    }

    // Trigger window resize for remote browser manager
    dispatchEvent('resize');

    setStorage((storageKey || 'userSidebarWidth'), JSON.stringify({ width, height }));
  }

  render() {
    const { axis, classes, flexGrow, overrideHeight, overrideWidth } = this.props;
    const { width, height } = this.state;
    const axisStyle = axis === 'x' ? { width: overrideWidth || width } : { height: overrideHeight || height };
    const flexSet = typeof flexGrow !== 'undefined';
    const hasResized = this.state.hasResized ? 0 : 1;
    const styles = { flexGrow: flexSet ? flexGrow : hasResized, ...axisStyle };

    return (
      <div
        ref={(obj) => { this.container = obj; }}
        className={classNames('wr-resizeable', classes)}
        style={styles}>
        {this.props.children}
        <div className={classNames('resizable-handle', [axis])} onMouseDown={this._startResize} />
      </div>
    );
  }
}

export default Resizable;
