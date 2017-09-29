import React from 'react';
import { connect } from 'react-redux';

import { getRemoteArchiveStats } from 'redux/selectors';

import { InfoWidgetUI } from 'components/controls';


const mapStateToProps = (state) => {
  return {
    collection: state.get('collection'),
    stats: getRemoteArchiveStats(state)
  };
};

export default connect(
  mapStateToProps
)(InfoWidgetUI);
