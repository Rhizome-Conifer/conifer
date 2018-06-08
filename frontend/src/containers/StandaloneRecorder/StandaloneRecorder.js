import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { showModal } from 'store/modules/userLogin';

import { getActiveCollection } from 'store/selectors';

import { StandaloneRecorderUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: getActiveCollection(app),
    extractable: app.getIn(['controls', 'extractable']),
    selectedBrowser: app.getIn(['remoteBrowsers', 'selectedBrowser']),
    username: app.getIn(['auth', 'user', 'username']),
    spaceUtilization: app.getIn(['auth', 'user', 'space_utilization'])
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
