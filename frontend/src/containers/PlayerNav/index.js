import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import PlayerNavUI from 'components/player/PlayerNavUI';


const mapStateToProps = ({ app }) => {
  return {
    collectionLoaded: app.getIn(['collection', 'loaded']),
    canGoBackward: app.getIn(['appSettings', 'canGoBackward']),
    canGoForward: app.getIn(['appSettings', 'canGoForward']),
    source: app.getIn(['appSettings', 'source'])
  };
};

export default withRouter(connect(mapStateToProps)(PlayerNavUI));
