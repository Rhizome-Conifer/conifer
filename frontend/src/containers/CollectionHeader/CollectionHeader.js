import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import { loadCollections } from 'redux/modules/auth';
import { resetEditState as resetCollEditState,
         edit as editCollDesc } from 'redux/modules/collection';

import CollectionHeaderUI from 'components/collection/CollectionHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
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
            history.replace(`/${user}/${res.collection.id}/index`);
          }
          return dispatch(loadCollections(user));
        }, () => {})
        .then(() => dispatch(resetCollEditState()));
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionHeaderUI));
