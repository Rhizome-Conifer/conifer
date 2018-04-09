import React from 'react';
import { connect } from 'react-redux';

import { addTo, create, deleteList, edit, resetEditState } from 'redux/modules/list';
import { loadLists } from 'redux/modules/collection';

import ListsUI from 'components/collection/ListsUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    loaded: app.getIn(['lists', 'loaded']),
    loading: app.getIn(['lists', 'loading']),
    lists: app.getIn(['collection', 'lists']),
    list: app.get('list'),
    isCreating: app.getIn(['list', 'creating']),
    created: app.getIn(['list', 'created'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createList: (user, coll, title) => {
      return dispatch(create(user, coll, title))
              .then(() => dispatch(loadLists(user, coll)));
    },
    getLists: (user, coll) => dispatch(loadLists(user, coll)),
    addToList: (user, coll, listId, data) => dispatch(addTo(user, coll, listId, data)),
    editList: (user, coll, id, data) => {
      return dispatch(edit(user, coll, id, data))
               .then(() => dispatch(loadLists(user, coll)))
               .then(() => setTimeout(() => dispatch(resetEditState()), 3000));
    },
    deleteList: (user, coll, id) => {
      return dispatch(deleteList(user, coll, id))
               .then(() => dispatch(loadLists(user, coll)));
    }
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ListsUI);
