import { fromJS } from 'immutable';

const SHOW_MODAL = 'wr/userLogin/SHOW_MODAL';

const initialState = fromJS({
  open: false,
  anonCTA: false
});

export default function userLogin(state = initialState, action = {}) {
  switch (action.type) {
    case SHOW_MODAL:
      return state.merge({
        open: action.bool,
        anonCTA: action.cta
      });
    default:
      return state;
  }
}

export function showModal(bool, cta = false) {
  return {
    type: SHOW_MODAL,
    bool,
    cta
  };
}

