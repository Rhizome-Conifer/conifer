import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './style.scss';


class PublicSwitch extends Component {
  static propTypes = {
    callback: PropTypes.func,
    isPublic: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = { active: false };
  }

  onEnter = () => this.setState({ active: true })
  onExit = () => this.setState({ active: false })

  render() {
    const { isPublic } = this.props;
    const { active } = this.state;

    const activeMsg = isPublic ? 'Set Collection Private' : 'Set Collection Public';
    const inactiveMsg = isPublic ? 'Public Collection' : 'Private Collection';

    return (
      <div onMouseEnter={this.onEnter} onMouseLeave={this.onExit} onClick={this.props.callback} style={{ display: 'inline-block' }}>
        <button className={classNames('wr-switch borderless', { 'is-public': isPublic })}>
          {
            active ? activeMsg : inactiveMsg
          }
        </button>
      </div>
    );
  }
}


export default PublicSwitch;
