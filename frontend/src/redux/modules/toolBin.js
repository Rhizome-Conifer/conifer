import { fromJS } from 'immutable';


const TOGGLE = 'wr/toolBin/TOGGLE';
const TOGGLE_CLIPBOARD = 'wr/toolBin/CLIPBOARD_OPEN';

const initialState = fromJS({
  open: false
});


export default function toolBin(state = initialState, action = {}) {
  switch (action.type) {
    case TOGGLE:
      return state.set('open', action.open);
    case TOGGLE_CLIPBOARD:
      return state.set('clipboard', action.bool);
    default:
      return state;
  }
}


export function toggleToolBin(bool) {
  return {
    type: TOGGLE,
    open: bool
  };
}


export function toggleClipboard(bool) {
  return {
    type: TOGGLE_CLIPBOARD,
    bool
  };
}
