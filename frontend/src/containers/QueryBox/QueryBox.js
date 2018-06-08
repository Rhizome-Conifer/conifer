import React from 'react';
import { connect } from 'react-redux';

import { changeQueryColumn, setQuery, setQueryMode } from 'store/modules/pageQuery';

import QueryBoxUI from 'components/QueryBoxUI';


const mapStateToProps = ({ app }) => {
  const pq = app.get('pageQuery');
  return {
    column: pq.get('column'),
    query: pq.get('query')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateQuery: str => dispatch(setQuery(str)),
    changeColumn: column => dispatch(changeQueryColumn(column)),
    clear: () => dispatch(setQueryMode(false))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(QueryBoxUI);
