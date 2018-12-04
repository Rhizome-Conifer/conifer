import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { doubleRAF, isEqual } from 'helpers/utils';

import './style.scss';


class Truncate extends Component {
  static propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
    height: PropTypes.number,
    propPass: PropTypes.string,
    showLess: PropTypes.bool,
    showMore: PropTypes.bool
  };

  static defaultProps = {
    className: '',
    height: 100,
    showLess: true,
    showMore: true
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      expanded: false,
      height: 'auto',
      noop: false
    };
  }

  componentDidMount() {
    const { height } = this.props;

    if (this.container) {
      // allow for child rendering ops before collapsing
      clearTimeout(this.handle);
      this.handle = setTimeout(() => {
        this.truncateTest();
      }, 30);
    }
  }

  componentDidUpdate(prevProps) {
    const keys = React.Children.map(this.props.children, c => c.key);
    const oldKeys = React.Children.map(prevProps.children, c => c.key);

    if (this.container && !isEqual(keys, oldKeys)) {
      this.setState({ height: 'auto', expanded: false });
      doubleRAF(this.truncateTest);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
  }

  truncateTest = () => {
    const { height } = this.props;

    const origHeight = this.container.getBoundingClientRect().height;
    if (origHeight < height) {
      this.setState({ noop: true, height: 'auto', expanded: true });
    } else {
      this.setState({ noop: false, height, origHeight, expanded: false });
    }
  }

  expand = () => {
    const { expanded, origHeight } = this.state;

    if (!expanded) {
      this.setState({
        expanded: true,
        height: origHeight
      });

      this.container.addEventListener(
        'transitionend',
        () => this.setState({ height: 'auto' }),
        { once: true }
      );
    }
  }

  collapse = () => {
    const { height } = this.props;

    const h = this.container.getBoundingClientRect().height;
    if (h && h !== this.state.origHeight) {
      this.setState({ origHeight: h, height: h });
    } else {
      this.setState({ height: h });
    }
    doubleRAF(() => this.setState({ expanded: false, height }));
  }

  render() {
    const { className, propPass, showLess, showMore } = this.props;
    const { expanded, height, noop } = this.state;

    return (
      <div
        className={classNames('wr-truncate', [className], { expanded })}
        ref={(obj) => { this.container = obj; }}
        style={{ height }}>
        {
          !expanded && !noop && showMore &&
            <button className="borderless show-more" onClick={this.expand} type="button">show more</button>
        }
        {
          this.props.propPass ?
            React.Children.map(this.props.children, child => React.cloneElement(child, { [propPass]: noop })) :
            this.props.children
        }
        {
          expanded && !noop && showLess &&
            <button className="show-less" onClick={this.collapse} type="button">show less</button>
        }
      </div>
    );
  }
}

export default Truncate;
