import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'store/modules/collection';
import { getOrderedRecordings } from 'store/selectors';
import { AccessContext } from 'store/contexts';

import CollectionManagementUI from 'components/collection/CollectionManagementUI';


class CollectionManagement extends Component {
  static propTypes = {
    auth: PropTypes.object,
    match: PropTypes.object,
    history: PropTypes.object
  };

  render() {
    const { auth, match: { params: { user } } } = this.props;
    const canAdmin = auth.getIn(['user', 'username']) === user;
    return (
      <AccessContext.Provider value={{ canAdmin }}>
        <CollectionManagementUI {...this.props} />
      </AccessContext.Provider>
    );
  }
}


const initialData = [
  {
    promise: ({ match: { params: { coll, user } }, store: { dispatch } }) => {
      return dispatch(loadColl(user, coll));
    }
  }
];

const mapStateToProps = (outerState) => {
  const { app, reduxAsyncConnect } = outerState;
  const isLoaded = app.getIn(['collection', 'loaded']);

  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    recordingEdited: app.getIn(['recordings', 'edited']),
    recordings: isLoaded ? getOrderedRecordings(app, true) : null
  };
};


export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionManagement);
