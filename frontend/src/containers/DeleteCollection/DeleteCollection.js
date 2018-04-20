import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { incrementCollCount } from 'redux/modules/auth';
import { deleteCollection } from 'redux/modules/collection';
import { deleteUserCollection } from 'redux/modules/user';

import DeleteCollectionUI from 'components/collection/DeleteCollectionUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection')
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
    }
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(DeleteCollectionUI));
