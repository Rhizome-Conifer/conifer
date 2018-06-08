import { fromJS } from 'immutable';

const SET_RESOURCE_STATS = 'wr/infoStats/SET_RESOURCE_STATS';
const RESET_RESOURCE_STATS = 'wr/infoStats/RESET_RESOURCE_STATS';

const initialState = fromJS({
  pending_size: 0,
  size: 0,
  stats: {},
});

export default function infoStats(state = initialState, action = {}) {
  switch(action.type) {
    case SET_RESOURCE_STATS:
      return state.merge(action.resourceStats);
    case RESET_RESOURCE_STATS:
      return initialState;
    default:
      return state;
  }
}

export function setStats(stats, size, pending_size = 0) {
  return {
    type: SET_RESOURCE_STATS,
    resourceStats: {
      stats,
      size,
      pending_size
    }
  };
}

export function resetStats() {
  return {
    type: RESET_RESOURCE_STATS
  };
}
