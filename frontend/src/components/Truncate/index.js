import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './style.scss';


class Truncate extends Component {
  static propTypes = {
    animated: PropTypes.bool,
    children: PropTypes.node,
    height: PropTypes.number,
    showLess: PropTypes.bool,
    showMore: PropTypes.bool
  };

  static defaultProps = {
    animated: true,
    height: 100,
    showLess: true,
    showMore: true
  };

  constructor(props) {
    super(props);

    this.state = {
      expanded: false,
      height: props.animated ? 'auto' : props.height,
      noop: false
    };
  }

  componentDidMount() {
    const { animated, height } = this.props;

    if (this.container) {
      // allow for child rendering ops before collapsing
      setTimeout(() => {
        const origHeight = this.container.getBoundingClientRect().height;
        if (origHeight < height) {
          this.setState({ noop: true, height: 'auto', expanded: true });
        } else {
          this.setState({ height, origHeight });
        }
      }, 10);
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

      if (animated) {
        this.container.addEventListener(
          'transitionend',
          () => this.setState({ height: 'auto' }),
          { once: true }
        );
      }
    }
  }

  collapse = () => {
    const { animated, height } = this.props;

    if (animated) {
      const h = this.container.getBoundingClientRect().height;
      if (h && h !== this.state.origHeight) {
        this.setState({ origHeight: h, height: h });
      } else {
        this.setState({ height: h });
      }
      setTimeout(() => this.setState({ expanded: false, height }), 50);
    } else {
      this.setState({
        expanded: false,
        height
      });
    }
  }

  render() {
    const { showLess, showMore } = this.props;
    const { expanded, height, noop } = this.state;

    return (
      <div
        className={classNames('wr-truncate', { expanded })}
        ref={(obj) => { this.container = obj; }}
        role={!expanded ? 'button' : 'presentation'}
        style={{ height }}
        title={!expanded ? 'Click to expand' : ''}>
        {
          !expanded && !noop && showMore &&
            <button className="borderless show-more" onClick={this.expand}>show more</button>
        }
        {this.props.children}
        {
          expanded && !noop && showLess &&
            <button className="show-less" onClick={this.collapse}>show less</button>
        }
      </div>
    );
  }
}

export default Truncate;
