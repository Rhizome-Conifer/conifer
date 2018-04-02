import { fromJS } from 'immutable';


const CHANGE_COLUMN = 'wr/query/CHANGE_COLUMN';
const QUERY_MODE = 'wr/query/QUERY_MODE';
const SET_QUERY = 'wr/query/SET_QUERY';

const initialState = fromJS({
  querying: false,
  column: '',
  query: ''
});


export default function pageQuery(state = initialState, action = {}) {
  switch (action.type) {
    case CHANGE_COLUMN:
      return state.set('column', action.column);
    case QUERY_MODE:
      return state.merge({
        querying: action.querying,
        column: action.column,
        query: action.query
      });
    case SET_QUERY:
      return state.set('query', action.query);
    default:
      return state;
  }
}


export function setQueryMode(bool, column = '', str = '') {
  return {
    type: QUERY_MODE,
    querying: bool,
    column,
    query: str
  };
}


export function changeQueryColumn(column) {
  return {
    type: CHANGE_COLUMN,
    column
  };
}


export function setQuery(str = '') {
  return {
    type: SET_QUERY,
    query: str
  };
}
