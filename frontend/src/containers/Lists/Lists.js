import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { load as loadLists } from 'redux/modules/lists';

import ListsUI from 'components/ListsUI';


class Lists extends Component {

  static propTypes = {
    collection: PropTypes.object,
    loaded: PropTypes.bool,
    loading: PropTypes.bool,
    lists: PropTypes.object,
    list: PropTypes.object,
    listId: PropTypes.string,
    getLists: PropTypes.func
  };

  componentWillMount() {
    const { getLists, loaded, loading } = this.props;

    if (!loaded && !loading) {
      getLists();
    }
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
    lists: app.getIn(['lists', 'lists'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getLists: () => dispatch(loadLists())
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Lists);
