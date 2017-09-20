import { fromJS } from 'immutable';

const SET_SIZE_COUNTER = 'wr/sizeCoutner/SET_SIZE_COUNTER';

const initialState = fromJS({
  size: 0
});

export default function sizeCounter(state = initialState, action = {}) {
  switch(action.type) {
    case SET_SIZE_COUNTER:
      return state.set('size', action.size);
    default:
      return state;
  }
}

export function setSizeCounter(bytes) {
  return {
    type: SET_SIZE_COUNTER,
    size: bytes
  };
}
