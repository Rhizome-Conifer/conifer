import { fromJS } from 'immutable';

const TOGGLE_CLIPBOARD = 'wr/toolBin/CLIPBOARD_OPEN';

const initialState = fromJS({
  clipboard: false
});


export default function toolBin(state = initialState, action = {}) {
  switch (action.type) {
    case TOGGLE_CLIPBOARD:
      return state.set('clipboard', action.bool);
    default:
      return state;
  }
}


export function toggleClipboard(bool) {
  return {
    type: TOGGLE_CLIPBOARD,
    bool
  };
}
