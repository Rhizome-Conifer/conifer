import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import PlayerNavUI from 'components/player/PlayerNavUI';


const mapStateToProps = ({ app }) => {
  return {
    collectionLoaded: app.getIn(['collection', 'loaded']),
    source: app.getIn(['appSettings', 'source'])
  };
};

export default withRouter(connect(mapStateToProps)(PlayerNavUI));
