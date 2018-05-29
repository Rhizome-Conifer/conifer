import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { doubleRAF } from 'helpers/utils';

import './style.scss';


class VisibilityLamp extends PureComponent {
  static propTypes = {
    callback: PropTypes.func,
    isPublic: PropTypes.bool,
    label: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      over: false,
      width: 'auto'
    };
  }

  componentDidMount() {
    const bcr = this.bulb.getBoundingClientRect();
    this.setState({
      origWidth: bcr.width,
      width: 0
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.isPublic !== prevProps.isPublic) {
      this.setState({
        width: 'auto'
      });

      doubleRAF(() => {
        const bcr = this.bulb.getBoundingClientRect();
        this.setState({
          origWidth: bcr.width,
          width: bcr.width
        });
      });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
  }

  showStatus = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => {
      this.setState({
        width: this.state.origWidth
      });
    }, 30);
  }

  hideStatus = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => {
      this.setState({
        width: 0
      });
    }, 30);
  }

  render() {
    const { isPublic, label } = this.props;
    const { width } = this.state;

    const help = isPublic ? `set ${label} public` : `set ${label} private`;

    return (
      <div
        aria-label={help}
        className={classNames('visibility-lamp', { 'is-public': isPublic })}
        onClick={this.props.callback}
        onMouseOver={this.showStatus}
        onMouseOut={this.hideStatus}
        title={help}>
        <div />
        <div ref={(obj) => { this.bulb = obj; }} className="bulb" style={{ width }}>
          <span>{isPublic ? 'Public' : 'Private'}</span>
        </div>
        <div />
      </div>
    );
  }
}

export default VisibilityLamp;
