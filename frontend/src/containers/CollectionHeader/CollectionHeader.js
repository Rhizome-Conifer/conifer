import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import { loadCollections } from 'store/modules/auth';
import { resetEditState as resetCollEditState, edit as editCollDesc, shareToDat, unshareFromDat } from 'store/modules/collection';

import CollectionHeaderUI from 'components/collection/CollectionHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    auth: app.getIn(['auth', 'user']),
    collection: app.get('collection'),
    collEditing: app.getIn(['collection', 'editing']),
    collEdited: app.getIn(['collection', 'edited']),
    collEditError: app.getIn(['collection', 'editError'])
  };
};

const mapDispatchToProps = (dispatch, { history }) => {
  return {
    editCollection: (user, coll, data) => {
      dispatch(editCollDesc(user, coll, data))
        .then((res) => {
          // if editing title, update url
          if (data.hasOwnProperty('title')) {
            history.replace(`/${user}/${res.collection.id}/manage`);
          }
          return dispatch(loadCollections(user));
        }, () => {})
        .then(() => dispatch(resetCollEditState()));
    },
    shareToDat: (user, coll) => dispatch(shareToDat(user, coll)),
    unshareFromDat: (user, coll) => dispatch(unshareFromDat(user, coll)),
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionHeaderUI));
