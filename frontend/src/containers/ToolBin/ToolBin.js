import React from 'react';
import { connect } from 'react-redux';

import { getBookmarkCount } from 'redux/selectors';

import ToolBinUI from 'components/ToolBinUI';


const mapStateToProps = (state, context) => {
  const toolBin = state.get('toolBin');
  const collection = state.get('collection');

  return {
    open: toolBin.get('open'),
    collSize: collection.get('size'),
    bookmarkCount: getBookmarkCount(state)
  };
};

export default connect(
  mapStateToProps
)(ToolBinUI);
