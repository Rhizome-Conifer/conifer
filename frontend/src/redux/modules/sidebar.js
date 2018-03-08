import { fromJS } from 'immutable';

const RESIZE = 'wr/sidebar/RESIZE';

const initialState = fromJS({
  resizing: false
});

export default function sidebar(state = initialState, action = {}) {
  switch (action.type) {
    case RESIZE:
      return state.set('resizing', action.resizing);
    default:
      return state;
  }
}


export function toggleSidebarResize(resizingBool) {
  return {
    type: RESIZE,
    resizing: resizingBool
  };
}
