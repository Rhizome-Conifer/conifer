import React from 'react';
import { connect } from 'react-redux';

import { getActiveBookmark } from 'redux/selectors';
import { editBookmark, load, resetBookmarkEdit } from 'redux/modules/list';

import ListMetadataUI from 'components/controls/ListMetadataUI';


const mapStateToProps = ({ app }) => {
  return {
    activeBookmark: getActiveBookmark(app),
    bkEdited: app.getIn(['list', 'bkEdited']),
    collection: app.get('collection'),
    list: app.get('list')
  };
};


const mapDispatchToProps = (dispatch) => {
  return {
    saveBookmarkEdit: (user, coll, list, bkId, data) => {
      dispatch(editBookmark(user, coll, list, bkId, data))
        .then(dispatch(load(user, coll, list)))
        .then(() => setTimeout(() => dispatch(resetBookmarkEdit()), 3000), () => { console.log('bkEdit error..'); });
    }
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ListMetadataUI);
