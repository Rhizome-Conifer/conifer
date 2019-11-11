import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { load as loadColl } from 'store/modules/collection';

import CollectionSearchUI from 'components/collection/CollectionSearchUI';


const mapStateToProps = (outerState) => {
  const { app, reduxAsyncConnect } = outerState;

  return {
    auth: app.get('auth'),
  };
};


export default connect(
  mapStateToProps
)(CollectionSearchUI);
