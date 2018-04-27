import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { inStorage, getStorage, setStorage } from 'helpers/utils';

import Resizable from 'components/Resizable';

import './style.scss';


class SidebarUI extends Component {

  static propTypes = {
    children: PropTypes.node,
    expanded: PropTypes.bool,
    resizing: PropTypes.bool,
    setSidebarResizing: PropTypes.func,
    storageKey: PropTypes.string,
    toggleSidebar: PropTypes.func
  };

  static defaultProps = {
    storageKey: 'sidebarDisplay'
  };

  constructor(props) {
    super(props);

    this.closedWidth = 1;
    this.state = { initTimeout: false };
  }

  componentDidMount() {
    const { storageKey, toggleSidebar } = this.props;

    // expanded by default
    let expanded = true;
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
