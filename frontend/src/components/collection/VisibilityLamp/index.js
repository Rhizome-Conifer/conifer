import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { doubleRAF } from 'helpers/utils';

import { LoaderIcon } from 'components/icons';

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
    this.editHandle = null;
    this.state = {
      editing: false,
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
      clearTimeout(this.editHandle);
      this.setState({
        width: 'auto',
        editing: false
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
    clearTimeout(this.editHandle);
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

  toggle = () => {
    clearTimeout(this.editHandle);
    // show loader if it's taking a while
    this.editHandle = setTimeout(() => this.setState({ editing: true }), 150);
    this.props.callback();
  }

  render() {
    const { isPublic, label } = this.props;
    const { editing, width } = this.state;

    const help = isPublic ? `set ${label} public` : `set ${label} private`;

    return (
      <div
        aria-label={help}
        className={classNames('visibility-lamp', { 'is-public': isPublic })}
        onClick={this.toggle}
        onMouseOver={this.showStatus}
        onMouseOut={this.hideStatus}
        title={help}>
        <div />
        <div ref={(obj) => { this.bulb = obj; }} className="bulb" style={{ width }}>
          {
            editing ?
              <LoaderIcon /> :
              <span>{isPublic ? 'Public' : 'Private'}</span>
          }
        </div>
        <div />
      </div>
    );
  }
}

export default VisibilityLamp;
