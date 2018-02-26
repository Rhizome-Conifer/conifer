import React from 'react';
import { connect } from 'react-redux';
import { defaultRecordingTitle } from 'config';


export const collList = ({ match }) => match.params.user;

const collDetail = ({ collection }) => { return collection.get('loaded') ? collection.get('title') : null };
export const collDetailBreadcrumb = connect(
  ({ app }) => {
    return {
      collection: app.get('collection')
    };
  })(collDetail);


const listDetail = ({ list }) => { return list ? list.get('title') : null; };
export const listDetailBreadcrumb = connect(
  ({ app }, { match: { params: { list } } }) => {
    return {
      list: list && app.getIn(['list', 'loaded']) ? app.getIn(['list', 'list']) : null
    };
  })(listDetail);


export const recording = ({ recording }) => { return recording ? recording.get('title') : defaultRecordingTitle };
export const recBookmark = connect(
  ({ app }) => {
    return {
      recording: app.getIn(['recordings', 'recording'])
    };
  })(recording);
