import React from 'react';
import { connect } from 'react-redux';

import { getRemoteArchiveStats } from 'store/selectors';

import { InfoWidgetUI } from 'components/controls';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    stats: getRemoteArchiveStats(app)
  };
};

export default connect(
  mapStateToProps
)(InfoWidgetUI);
