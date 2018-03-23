import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { incrementCollCount } from 'redux/modules/auth';
import { deleteCollection, load as loadColl, resetSaveState as resetCollSaveState,
         saveDescription as saveCollDesc, setPublic } from 'redux/modules/collection';
import { edit as editList, resetEditState } from 'redux/modules/list';
import { deleteUserCollection } from 'redux/modules/user';

import CollectionHeaderUI from 'components/collection/CollectionHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    collSaveSuccess: app.getIn(['collection', 'descSave']),
    list: app.get('list'),
    listEdited: app.getIn(['list', 'edited']),
    listSaveSuccess: app.getIn(['list', 'edited'])
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
    saveListEdit: (user, coll, listId, data) => {
      dispatch(editList(user, coll, listId, data))
        .then(() => dispatch(loadColl(user, coll)))
        .then(() => setTimeout(() => dispatch(resetEditState()), 3000), () => {});
    },
    saveDescription: (user, coll, desc) => {
      dispatch(saveCollDesc(user, coll, desc))
        .then(() => setTimeout(() => dispatch(resetCollSaveState()), 3000));
    },
    setCollPublic: (collId, user, bool) => dispatch(setPublic(collId, user, bool)),
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionHeaderUI));
