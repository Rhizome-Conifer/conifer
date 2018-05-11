import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CSSTransitionGroup } from 'react-transition-group';

import './style.scss';


class PublicSwitch extends PureComponent {
  static propTypes = {
    callback: PropTypes.func,
    isPublic: PropTypes.bool,
    publicLists: PropTypes.number
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    const { isPublic } = nextProps;
    if (isPublic !== prevState.isPublic) {
      return {
        active: false,
        isPublic
      };
    }

    return null;
  }

  constructor(props) {
    super(props);
    this.handle = null;
    this.state = { active: false, isPublic: props.isPublic };
  }

  onEnter = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => this.setState({ active: true }), 100);
  }

  onExit = () => {
    clearTimeout(this.handle);
    if (this.state.active) {
      this.setState({ active: false });
    }
  }

  callback = (evt) => {
    evt.stopPropagation();
    this.props.callback();
  }

  render() {
    const { publicLists } = this.props;
    const { active, adjusted, isPublic } = this.state;

    const toggleButton = (
      <button onClick={this.callback} key="toggle" className={classNames('toggle', { 'is-public': isPublic })}>
        {isPublic ? 'Set collection to private' : 'Make collection viewable to public'}
      </button>
    );

    return (
      <div
        className={classNames('wr-switch', { adjusted })}
        onMouseEnter={this.onEnter}
        onMouseLeave={this.onExit}>
        <CSSTransitionGroup
          component="div"
          transitionName="switch"
          transitionEnterTimeout={350}
          transitionLeaveTimeout={350}>
          {
            active ?
            toggleButton :
            <div className="coll-status" key="status">
              {
                isPublic ?
                  <React.Fragment>
                    <span>Public Collection</span>
                    <span className="public-lists">{`${publicLists} Published List${publicLists === 1 ? '' : 's'}`}</span>
                  </React.Fragment> :
                  <div className="private">Private Collection</div>
              }
            </div>
          }
        </CSSTransitionGroup>
      </div>
    );
  }
}


export default PublicSwitch;
