import React from 'react';
import { connect } from 'react-redux';


export const collList = ({ match }) => <span>{match.params.user}</span>;

const collDetail = ({ collection }) => <span>{collection.get('title')}</span>;
export const collDetailBookmark = connect(
  ({ app }) => { return { collection: app.get('collection') }; }
)(collDetail);
