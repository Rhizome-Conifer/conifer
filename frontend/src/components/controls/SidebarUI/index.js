import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { inStorage, getStorage, setStorage } from 'helpers/utils';

import { SidebarToggle } from 'components/icons';
import { SidebarBookmarkList } from 'components/controls';

import './style.scss';


class SidebarUI extends Component {

  static propTypes = {
    activeBookmark: PropTypes.number,
    bookmarks: PropTypes.object,
    dispatch: PropTypes.func,
    searchBookmarks: PropTypes.func,
    searchText: PropTypes.string,
    sidebarResize: PropTypes.func
  }

  constructor(props) {
    super(props);

    this.state = {
      expanded: false,
      userWidth: 275,
      defaultWidth: 'auto',
      xPos: null
    };
  }

  componentDidMount() {
    // expanded by default
    let expanded = true;
    if (inStorage('sidebarDisplay')) {
      try {
        expanded = JSON.parse(getStorage('sidebarDisplay'));
      } catch (e) {
        console.log('Wrong `sidebarDisplay` storage value');
      }
    }

    let userWidth = 275;
    if (inStorage('userSidebarWidth')) {
      try {
        userWidth = JSON.parse(getStorage('userSidebarWidth'));
      } catch (e) {
        console.log('Error retrieving userWidth', e);
      }
    }

    this.setState({
      defaultWidth: this.sidebarHandle.getBoundingClientRect().width,
      expanded,
      userWidth
    });
  }

  onToggle = () => {
    const { expanded } = this.state;

    setStorage('sidebarDisplay', !expanded);
    this.setState({
      expanded: !expanded
    });
  }

  startResize = (evt) => {
    this.setState({
      xPos: evt.clientX
    });

    this.props.sidebarResize(true);

    document.addEventListener('mousemove', this.sidebarPosition);
    document.addEventListener('mouseup', this.endResize, { once: true });
  }

  sidebarPosition = (evt) => {
    requestAnimationFrame(() => {
      const curX = evt.clientX;
      if (curX !== this.state.userWidth) {
        this.setState({
          userWidth: Math.min(window.innerWidth * 0.5, Math.max(this.state.defaultWidth * 3, curX))
        });
      }
    });
  }

  endResize = () => {
    document.removeEventListener('mousemove', this.sidebarPosition);
    this.props.sidebarResize(false);
    setStorage('userSidebarWidth', this.state.userWidth);
    this.setState({ xPos: null });
  }

  render() {
    const { defaultWidth, expanded, userWidth } = this.state;

    const width = expanded ? userWidth : defaultWidth;
    const classes = classNames('sidebar', {
      animate: !this.state.xPos,
      expanded
    });

    return (
      <aside
        ref={(obj) => { this.sidebarHandle = obj; }}
        className={classes}
        style={{ width }}>
        <button
          className="sidebar-toggle"
          onClick={this.onToggle}>
          <SidebarToggle flip={!expanded} />
        </button>
        <div className="sidebar-handle" onMouseDown={this.startResize} />
        {
          expanded &&
            <SidebarBookmarkList {...this.props} />
        }
      </aside>
    );
  }
}

export default SidebarUI;
