import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { showModal } from 'redux/modules/userLogin';

import { getActiveCollection } from 'redux/selectors';

import { StandaloneRecorderUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: getActiveCollection(app),
    extractable: app.getIn(['controls', 'extractable']),
    selectedBrowser: app.getIn(['remoteBrowsers', 'selectedBrowser']),
    username: app.getIn(['user', 'username']),
    spaceUtilization: app.getIn(['user', 'space_utilization'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleLogin: (bool, next) => dispatch(showModal(bool, true, next))
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(StandaloneRecorderUI));
