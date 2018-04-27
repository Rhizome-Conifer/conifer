import { fromJS } from 'immutable';

const CLEAR = 'wr/inspector/CLEAR';
const MULTI_SELECT = 'wr/inspector/MULTI_SELECT';
const SELECT_PAGE = 'wr/inspector/SELECT_PAGE';
const SELECT_BK = 'wr/inspector/SELECT_BK';

const initialState = fromJS({
  multi: null,
  selectedBk: null,
  selectedPage: null
});


export default function sidebar(state = initialState, action = {}) {
  switch (action.type) {
    case CLEAR:
      return state.merge(initialState);
    case MULTI_SELECT:
      return state.merge({
        multi: action.count,
        selectedBk: null,
        selectedPage: null
      });
    case SELECT_PAGE:
      return state.merge({
        multi: null,
        selectedPage: action.id
      });
    case SELECT_BK: {
      return state.merge({
        multi: null,
        selectedBk: action.bk
      });
    }
    default:
      return state;
  }
}

export function clear() {
  return {
    type: CLEAR
  };
}


export function multiSelect(count) {
  return {
    type: MULTI_SELECT,
    count
  };
}


export function selectBookmark(bk) {
  return {
    type: SELECT_BK,
    bk
  };
}


export function selectPage(id) {
  return {
    type: SELECT_PAGE,
    id
  };
}
