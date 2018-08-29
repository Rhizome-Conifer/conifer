import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import { load as loadColl } from 'redux/modules/collection';
import { edit as editList, resetEditState } from 'redux/modules/list';

import ListHeaderUI from 'components/collection/ListHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    list: app.get('list'),
    listEdited: app.getIn(['list', 'edited'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    editList: (user, coll, listId, data) => {
      dispatch(editList(user, coll, listId, data))
        .then(() => dispatch(loadColl(user, coll)))
        .then(() => setTimeout(() => dispatch(resetEditState()), saveDelay), () => {});
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(ListHeaderUI));
