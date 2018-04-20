import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { load as loadColl, resetEditState as resetCollEditState,
         edit as editCollDesc } from 'redux/modules/collection';
import { edit as editList, resetEditState } from 'redux/modules/list';

import CollectionHeaderUI from 'components/collection/CollectionHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    collEdited: app.getIn(['collection', 'edited']),
    collEditError: app.getIn(['collection', 'editError']),
    list: app.get('list'),
    listEdited: app.getIn(['list', 'edited'])
  };
};

const mapDispatchToProps = (dispatch, { history }) => {
  return {
    editList: (user, coll, listId, data) => {
      dispatch(editList(user, coll, listId, data))
        .then(() => dispatch(loadColl(user, coll)))
        .then(() => setTimeout(() => dispatch(resetEditState()), 3000), () => {});
    },
    editCollection: (user, coll, data) => {
      dispatch(editCollDesc(user, coll, data))
        .then((res) => {
          // if editing title, redirect to new title url
          if (data.hasOwnProperty('title')) {
            history.push(`/${user}/${res.collection.id}`);
          }

          setTimeout(() => dispatch(resetCollEditState()), 3000);
        });
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionHeaderUI));
