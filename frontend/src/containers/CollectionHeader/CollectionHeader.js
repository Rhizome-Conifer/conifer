import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import { resetEditState as resetCollEditState,
         edit as editCollDesc } from 'redux/modules/collection';
import { loadCollections } from 'redux/modules/user';

import CollectionHeaderUI from 'components/collection/CollectionHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    collEdited: app.getIn(['collection', 'edited']),
    collEditError: app.getIn(['collection', 'editError'])
  };
};

const mapDispatchToProps = (dispatch, { history }) => {
  return {
    editCollection: (user, coll, data) => {
      dispatch(editCollDesc(user, coll, data))
        .then((res) => {
          // if editing title, redirect to new title url
          if (data.hasOwnProperty('title')) {
            history.replace(`/${user}/${res.collection.id}/pages`);
          }

          setTimeout(() => dispatch(resetCollEditState()), saveDelay);
        })
        .then(() => dispatch(loadCollections(user)));
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionHeaderUI));
