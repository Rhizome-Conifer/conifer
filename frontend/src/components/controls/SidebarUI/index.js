import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { dispatchEvent, inStorage, getStorage, setStorage } from 'helpers/utils';

import Resizable from 'components/Resizable';

import './style.scss';


class SidebarUI extends Component {
  static propTypes = {
    children: PropTypes.node,
    defaultExpanded: PropTypes.bool,
    expanded: PropTypes.bool,
    resizing: PropTypes.bool,
    setSidebarResizing: PropTypes.func,
    storageKey: PropTypes.string,
    toggleSidebar: PropTypes.func
  };

  static defaultProps = {
    defaultExpanded: true,
    storageKey: 'sidebarDisplay'
  };

  constructor(props) {
    super(props);

    this.closedWidth = 1;
    this.state = { initTimeout: false };
  }

  componentDidMount() {
    const { defaultExpanded, storageKey, toggleSidebar } = this.props;

    let expanded = defaultExpanded;
    if (inStorage(storageKey)) {
      try {
        expanded = JSON.parse(getStorage(storageKey));
      } catch (e) {
        console.log(`Wrong '${storageKey}' storage value`);
      }
    }

    toggleSidebar(expanded);

    // allow Resizable to retreive stored width before animating
    setTimeout(() => this.setState({ initTimeout: true }), 100);
  }

  componentDidUpdate(prevProps) {
    const { expanded, storageKey } = this.props;

    if (prevProps.expanded !== expanded) {
      setStorage(storageKey, expanded);
      dispatchEvent('resize');
    }
  }

  render() {
    const { children, expanded, resizing, storageKey } = this.props;
    const { initTimeout } = this.state;

    const classes = classNames('wr-sidebar', {
      animate: initTimeout && !resizing,
      expanded
    });

    return (
      <Resizable
        classes={classes}
        flexGrow={0}
        resizeState={this.props.setSidebarResizing}
        storageKey={`${storageKey}Width`}
        overrideWidth={!expanded && this.closedWidth}
        minWidth={175}>
        <div className="wr-sidebar-stretch">
          {
            expanded && children
          }
        </div>
      </Resizable>
    );
  }
}

export default SidebarUI;
