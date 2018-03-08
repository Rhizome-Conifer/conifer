import { fromJS } from 'immutable';

const TOGGLE = 'wr/toolBin/TOGGLE';

const initialState = fromJS({
  open: false
});

export default function toolBin(state = initialState, action = {}) {
  switch (action.type) {
    case TOGGLE:
      return state.set('open', action.open);
    default:
      return state;
  }
}


export function toggleToolBin(binBool) {
  return {
    type: TOGGLE,
    open: binBool
  };
}
