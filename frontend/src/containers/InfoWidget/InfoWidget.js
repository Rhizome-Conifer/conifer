import React from 'react';
import { connect } from 'react-redux';

import { getReplayStats } from 'redux/selectors';

import { InfoWidgetUI } from 'components/controls';


const mapStateToProps = (state) => {
  return {
    collection: state.get('collection'),
    stats: getReplayStats(state)
  };
};

export default connect(
  mapStateToProps
)(InfoWidgetUI);
