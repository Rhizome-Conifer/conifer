import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { addTo, create, deleteList, edit, load as loadList } from 'redux/modules/list';
import { loadLists } from 'redux/modules/collection';

import ListsUI from 'components/ListsUI';


class Lists extends Component {

  static propTypes = {
    activeListId: PropTypes.string,
    collection: PropTypes.object,
    loaded: PropTypes.bool,
    loading: PropTypes.bool,
    lists: PropTypes.object,
    list: PropTypes.object,
    getLists: PropTypes.func,
    editList: PropTypes.func,
    removeList: PropTypes.func
  };

  componentWillMount() {
    const { getLists, loaded, loading } = this.props;

    // if (!loaded && !loading) {
    //   getLists();
    // }
  }

  render() {
    return <ListsUI {...this.props} />;
  }
}


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    loaded: app.getIn(['lists', 'loaded']),
    loading: app.getIn(['lists', 'loading']),
    lists: app.getIn(['collection', 'lists']),
    list: app.getIn(['list', 'list']),
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
               .then(() => dispatch(loadLists(user, coll)));
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
)(Lists);
