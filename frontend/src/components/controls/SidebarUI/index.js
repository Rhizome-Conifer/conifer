import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { inStorage, getStorage, setStorage } from 'helpers/utils';

import Resizable from 'components/Resizable';
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
    sidebarResize: PropTypes.func,
    resizing: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.closedWidth = 30;
    this.state = { expanded: false, initTimeout: false };
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

    this.setState({ expanded });

    // allow Resizable to retreive stored width before animating
    setTimeout(() => this.setState({ initTimeout: true }), 100);
  }

  onToggle = () => {
    const { expanded } = this.state;

    setStorage('sidebarDisplay', !expanded);
    this.setState({
      expanded: !expanded
    });
  }

  render() {
    const { resizing } = this.props;
    const { expanded, initTimeout } = this.state;

    const classes = classNames('sidebar', {
      animate: initTimeout && !resizing,
      expanded
    });

    return (
      <Resizable
        classes={classes}
        resizeState={this.props.sidebarResize}
        storageKey="replaySidebarWidth"
        overrideWidth={!expanded && this.closedWidth}>
        <button
          className="sidebar-toggle"
          onClick={this.onToggle}>
          <SidebarToggle flip={!expanded} />
        </button>
        {
          expanded &&
            <SidebarBookmarkList {...this.props} />
        }
      </Resizable>
    );
  }
}

export default SidebarUI;
