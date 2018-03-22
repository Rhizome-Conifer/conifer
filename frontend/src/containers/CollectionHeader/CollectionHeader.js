import React from 'react';
import { connect } from 'react-redux';

import { load as loadColl, resetSaveState as resetCollSaveState,
         saveDescription as saveCollDesc } from 'redux/modules/collection';
import { edit as editList, resetEditState } from 'redux/modules/list';

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

const mapDispatchToProps = (dispatch) => {
  return {
    saveListEdit: (user, coll, listId, data) => {
      dispatch(editList(user, coll, listId, data))
        .then(() => dispatch(loadColl(user, coll)))
        .then(() => setTimeout(() => dispatch(resetEditState()), 3000), () => {});
    },
    saveDescription: (user, coll, desc) => {
      dispatch(saveCollDesc(user, coll, desc))
        .then(() => setTimeout(() => dispatch(resetCollSaveState()), 3000));
    },
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionHeaderUI);
