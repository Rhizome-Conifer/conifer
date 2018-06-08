import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { deleteUserCollection, deleteUser, incrementCollCount } from 'store/modules/auth';
import { deleteCollection } from 'store/modules/collection';

import DeleteCollectionUI from 'components/collection/DeleteCollectionUI';


const mapStateToProps = ({ app }, props) => {
  return {
    collection: props.collection || app.get('collection'),
    deleting: app.getIn(['collection', 'editing']),
    error: app.getIn(['collection', 'editError']),
    user: app.getIn(['auth', 'user'])
  };
};

const mapDispatchToProps = (dispatch, { history }) => {
  return {
    deleteColl: (user, coll, isAnon = false) => {
      dispatch(deleteCollection(user, coll))
        .then((res) => {
          if (res.hasOwnProperty('deleted_id')) {
            if (isAnon && user.startsWith('temp-')) {
              // if anon user, delete user along with collection
              dispatch(deleteUser(user))
                .then(() => { window.location = '/'; });
            } else {
              dispatch(incrementCollCount(-1));
              dispatch(deleteUserCollection(res.deleted_id));
              history.push(`/${user}`);
            }
          }
        }, () => {});
    }
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(DeleteCollectionUI));
