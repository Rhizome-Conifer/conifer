import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './style.scss';


class Truncate extends Component {
  static propTypes = {
    animated: PropTypes.bool,
    children: PropTypes.node,
    height: PropTypes.number,
    showLess: PropTypes.bool
  };

  static defaultProps = {
    animated: true,
    height: 100,
    showLess: true
  };

  constructor(props) {
    super(props);

    this.state = {
      expanded: false,
      height: props.animated ? 'auto' : props.height
    };
  }

  componentDidMount() {
    const { animated, height } = this.props;

    if (animated && this.container) {
      // allow for child rendering ops before collapsing
      setTimeout(() => {
        const origHeight = this.container.getBoundingClientRect().height;
        this.setState({ height, origHeight });
      }, 100);
    }
  }

  expand = () => {
    const { animated } = this.props;
    const { expanded, origHeight } = this.state;

    if (!expanded) {
      this.setState({
        expanded: true,
        height: animated ? origHeight : 'auto'
      });
    }
  }

  collapse = () => {
    const { height } = this.props;

    this.setState({
      expanded: false,
      height
    });
  }

  render() {
    const { expanded, height } = this.state;

    return (
      <div
        className={classNames('wr-truncate', { expanded })}
        onClick={this.expand}
        ref={(obj) => { this.container = obj; }}
        role={!expanded ? 'button' : 'presentation'}
        style={{ height }}
        title={!expanded ? 'Click to expand' : ''}>
        {this.props.children}
        <button className="show-less" onClick={this.collapse}>show less</button>
      </div>
    );
  }
}

export default Truncate;
