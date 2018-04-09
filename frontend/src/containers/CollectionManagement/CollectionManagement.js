import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'redux/modules/collection';
import { deleteRecording } from 'redux/modules/recordings';
import { getOrderedRecordings } from 'redux/selectors';


import CollectionManagementUI from 'components/collection/CollectionManagementUI';


class CollectionManagement extends Component {

  static propTypes = {
    auth: PropTypes.object,
    match: PropTypes.object,
    history: PropTypes.object
  };

    // TODO move to HOC
  static childContextTypes = {
    canAdmin: PropTypes.bool
  };

  getChildContext() {
    const { auth, match: { params: { user } } } = this.props;
    const username = auth.getIn(['user', 'username']);

    return {
      canAdmin: username === user
    };
  }

  componentDidMount() {
    const { auth, match: { params: { coll, user } } } = this.props;
    const username = auth.getIn(['user', 'username']);

    if (username !== user) {
      this.props.history.push(`/${user}/${coll}`);
    }
  }

  render() {
    return (
      <CollectionManagementUI {...this.props} />
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
    recordings: isLoaded ? getOrderedRecordings(app) : null,
    loaded: reduxAsyncConnect.loaded
  };
};

const mapDispatchToProps = (dispatch, { match: { params: { user, coll } } }) => {
  return {
    deleteRec: (rec) => {
      dispatch(deleteRecording(user, coll, rec))
        .then((res) => {
          if (res.hasOwnProperty('deleted_id')) {
            dispatch(loadColl(user, coll));
          }
        }, () => { console.log('Rec delete error..'); });
    },
    dispatch
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps,
  mapDispatchToProps
)(CollectionManagement);
