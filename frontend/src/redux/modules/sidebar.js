import { fromJS } from 'immutable';

const RESIZE = 'wr/sidebar/RESIZE';
const TOGGLE = 'wr/sidebar/TOGGLE';

const initialState = fromJS({
  resizing: false,
  expanded: false
});


export default function sidebar(state = initialState, action = {}) {
  switch (action.type) {
    case RESIZE:
      return state.set('resizing', action.resizing);
    case TOGGLE:
      return state.set('expanded', action.bool);
    default:
      return state;
  }
}


export function sidebarResize(resizingBool) {
  return {
    type: RESIZE,
    resizing: resizingBool
  };
}


export function toggle(bool) {
  return {
    type: TOGGLE,
    bool
  };
}
