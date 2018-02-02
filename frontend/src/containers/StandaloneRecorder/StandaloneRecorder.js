import React from 'react';
import { connect } from 'react-redux';

import { getActiveCollection } from 'redux/selectors';

import { StandaloneRecorderUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: getActiveCollection(app),
    extractable: app.getIn(['controls', 'extractable']),
    selectedBrowser: app.getIn(['remoteBrowsers', 'selectedBrowser']),
    username: app.getIn(['user', 'username'])
  };
};

export default connect(
  mapStateToProps
)(StandaloneRecorderUI);
