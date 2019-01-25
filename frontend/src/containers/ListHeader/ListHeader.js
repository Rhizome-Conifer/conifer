import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { saveDelay } from 'config';

import { load as loadColl } from 'store/modules/collection';
import { edit as editList, resetEditState } from 'store/modules/list';

import ListHeaderUI from 'components/collection/ListHeaderUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    list: app.get('list'),
    listEditing: app.getIn(['list', 'editing']),
    listEdited: app.getIn(['list', 'edited']),
    listError: app.getIn(['list', 'error'])
  };
};

const mapDispatchToProps = (dispatch, { history }) => {
  return {
    editList: (user, coll, listId, data) => {
      dispatch(editList(user, coll, listId, data))
        .then((res) => {
          if (data.hasOwnProperty('title')) {
            history.replace(`/${user}/${coll}/list/${res.list.slug}/manage`);
          }
          return dispatch(loadColl(user, coll));
        }, () => {})
        .then(() => dispatch(resetEditState()), () => {});
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(ListHeaderUI));
