import { fromJS } from 'immutable';

const SHOW_MODAL = 'wr/userLogin/SHOW_MODAL';

const initialState = fromJS({
  anonCTA: false,
  next: null,
  open: false
});

export default function userLogin(state = initialState, action = {}) {
  switch (action.type) {
    case SHOW_MODAL:
      return state.merge({
        anonCTA: action.cta,
        next: action.next,
        open: action.bool
      });
    default:
      return state;
  }
}

export function showModal(bool, cta = false, next = null) {
  return {
    type: SHOW_MODAL,
    bool,
    cta,
    next
  };
}
