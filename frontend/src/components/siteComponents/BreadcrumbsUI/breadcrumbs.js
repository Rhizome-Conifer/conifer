import React from 'react';
import { connect } from 'react-redux';
import { defaultRecordingTitle } from 'config';


export const collList = ({ match }) => match.params.user;

const collDetail = ({ collection }) => { return collection.get('loaded') ? collection.get('title') : ''; };
export const collDetailBookmark = connect(
  ({ app }) => {
    return {
      collection: app.get('collection')
    };
  })(collDetail);

export const recording = ({ recording }) => { return recording ? recording.get('title') : defaultRecordingTitle };
export const recBookmark = connect(
  ({ app }) => {
    return {
      recording: app.getIn(['recordings', 'recording'])
    };
  })(recording);
