import React from 'react';
import { connect } from 'react-redux';

import { saveDelay } from 'config';

import { load as loadColl } from 'store/modules/collection';
import { deleteRecording, edit, resetEditState } from 'store/modules/recordings';
import { getOrderedRecordings, splitPagesBySession } from 'store/selectors';

import SessionCollapsibleUI from 'components/collection/SessionCollapsibleUI';


const mapStateToProps = ({ app }) => {
  const isLoaded = app.getIn(['collection', 'loaded']);

  return {
    collection: app.get('collection'),
    loadedRecBK: app.getIn(['recordings', 'loadedRecBK']),
    loadingRecBK: app.getIn(['recordings', 'loadingRecBK']),
    pagesBySession: splitPagesBySession(app),
    recordingBookmarks: app.getIn(['recordings', 'recordingBookmarks']),
    recordingDeleted: app.getIn(['recordings', 'deleted']),
    recordingDeleting: app.getIn(['recordings', 'deleting']),
    recordingEdited: app.getIn(['recordings', 'edited']),
    recordings: isLoaded ? getOrderedRecordings(app, true) : null
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    deleteRec: (user, coll, rec) => {
      dispatch(deleteRecording(user, coll, rec))
        .then((res) => {
          if (res.hasOwnProperty('deleted_id')) {
            dispatch(loadColl(user, coll));
          }
        }, () => { console.log('Rec delete error..'); });
    },
    editRec: (user, coll, rec, data) => {
      dispatch(edit(user, coll, rec, data))
        .then(() => dispatch(loadColl(user, coll)))
        .then(() => setTimeout(() => dispatch(resetEditState()), saveDelay), () => {});
    },
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SessionCollapsibleUI);
