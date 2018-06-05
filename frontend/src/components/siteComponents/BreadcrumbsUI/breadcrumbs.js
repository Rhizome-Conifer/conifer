import React from 'react';
import { connect } from 'react-redux';


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
      list: list && app.getIn(['list', 'loaded']) ? app.get('list') : null
    };
  })(listDetail);
