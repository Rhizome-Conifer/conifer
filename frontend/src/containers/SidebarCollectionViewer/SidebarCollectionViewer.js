import React from 'react';
import { connect } from 'react-redux';

import { timestampOrderedPages } from 'store/selectors';

import { SidebarCollectionViewerUI } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;

  return {
    collection: app.get('collection'),
    orderdPages: timestampOrderedPages(app)
  };
};

export default connect(
  mapStateToProps
)(SidebarCollectionViewerUI);
