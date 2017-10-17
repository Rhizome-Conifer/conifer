import React from 'react';
import { connect } from 'react-redux';

import { getActiveCollection } from 'redux/selectors';

import { StandaloneRecorderUI } from 'components/controls';


const mapStateToProps = (state) => {
  const controls = state.get('controls');
  const user = state.get('user');

  return {
    activeCollection: getActiveCollection(state),
    extractable: controls.get('extractable'),
    selectedBrowser: state.getIn(['remoteBrowsers', 'selectedBrowser']),
    username: user.get('username')
  };
};

export default connect(
  mapStateToProps
)(StandaloneRecorderUI);
