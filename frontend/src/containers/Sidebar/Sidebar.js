import React from 'react';
import { connect } from 'react-redux';

import { toggleSidebarResize } from 'redux/modules/sidebar';

import { SidebarUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    resizing: app.getIn(['sidebar', 'resizing'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    sidebarResize: bool => dispatch(toggleSidebarResize(bool)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarUI);
