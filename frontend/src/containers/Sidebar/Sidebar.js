import React from 'react';
import { connect } from 'react-redux';

import { sidebarResize, toggle } from 'store/modules/sidebar';

import { SidebarUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    expanded: app.getIn(['sidebar', 'expanded']),
    resizing: app.getIn(['sidebar', 'resizing'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setSidebarResizing: bool => dispatch(sidebarResize(bool)),
    toggleSidebar: bool => dispatch(toggle(bool)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarUI);
