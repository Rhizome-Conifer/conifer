import { fromJS } from 'immutable';

const SHOW_MODAL = 'wr/userLogin/SHOW_MODAL';

const initialState = fromJS({
  open: false
});

export default function userLogin(state = initialState, action = {}) {
  switch (action.type) {
    case SHOW_MODAL:
      return state.set('open', action.bool);
    default:
      return state;
  }
}

export function showModal(bool) {
  return {
    type: SHOW_MODAL,
    bool
  };
}

