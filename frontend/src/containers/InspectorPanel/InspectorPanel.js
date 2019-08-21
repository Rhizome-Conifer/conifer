import React, { Component } from 'react';
import { connect } from 'react-redux';

import { saveDelay } from 'config';

import { editBookmark, load, resetBookmarkEdit } from 'store/modules/list';
import { AccessContext } from 'store/contexts';

import InspectorPanelUI from 'components/collection/InspectorPanelUI';


class InspectorPanel extends Component {

  render() {
    const { canAdmin } = this.props;
    return (
      <AccessContext.Provider value={{ canAdmin }}>
        <InspectorPanelUI {...this.props} />
      </AccessContext.Provider>
    );
  }
}


const mapStateToProps = ({ app }) => {
  return {
    bkEdited: app.getIn(['list', 'bkEdited']),
    browsers: app.get('remoteBrowsers'),
    collection: app.get('collection'),
    list: app.get('list'),
    multiSelect: app.getIn(['inspector', 'multi']),
    selectedPage: app.getIn(['inspector', 'selectedPage']),
    selectedBk: app.getIn(['inspector', 'selectedBk'])
  };
};


const mapDispatchToProps = (dispatch) => {
  return {
    saveBookmarkEdit: (user, coll, list, bkId, data) => {
      dispatch(editBookmark(user, coll, list, bkId, data))
        .then(() => dispatch(load(user, coll, list)))
        .then(() => setTimeout(() => dispatch(resetBookmarkEdit()), saveDelay), () => { console.log('bkEdit error..'); });
    }
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InspectorPanel);
