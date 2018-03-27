import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { incrementCollCount } from 'redux/modules/auth';
import { deleteCollection, load as loadColl, resetEditState as resetCollEditState,
         edit as editCollDesc, setPublic } from 'redux/modules/collection';
import { edit as editList, resetEditState } from 'redux/modules/list';
import { deleteUserCollection } from 'redux/modules/user';

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
    deleteColl: (user, coll) => {
      dispatch(deleteCollection(user, coll))
        .then((res) => {
          if (res.hasOwnProperty('deleted_id')) {
            dispatch(incrementCollCount(-1));
            dispatch(deleteUserCollection(res.deleted_id));
            history.push(`/${user}`);
          }
        }, () => {});
    },
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
