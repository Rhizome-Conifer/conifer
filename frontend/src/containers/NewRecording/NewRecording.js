import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { isLoaded, load as loadColl } from 'store/modules/collection';

import { NewRecordingUI } from 'components/controls';


class NewRecording extends Component {
  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    extractable: PropTypes.object,
    match: PropTypes.object
  };

  render() {
    return (
      <NewRecordingUI {...this.props} />
    );
  }
}

const loadCollection = [
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.app.get('collection');
      const { user, coll } = params;

      if (!isLoaded(state) || collection.get('id') !== coll) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    extractable: app.getIn(['controls', 'extractable']),
    remoteBrowserSelected: app.getIn(['remoteBrowsers', 'selectedBrowser']),
    spaceUtilization: app.getIn(['auth', 'user', 'space_utilization'])
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(NewRecording);
