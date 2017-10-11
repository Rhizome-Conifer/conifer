import { fromJS } from 'immutable';

const SET_RESOURCE_STATS = 'wr/infoWidget/SET_RESOURCE_STATS';
const RESET_RESOURCE_STATS = 'wr/infoWidget/RESET_RESOURCE_STATS';

const initialState = fromJS({
  stats: {},
  size: 0
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

export function setStats(stats, size) {
  return {
    type: SET_RESOURCE_STATS,
    resourceStats: {
      stats,
      size
    }
  };
}

export function resetStats() {
  return {
    type: RESET_RESOURCE_STATS
  };
}
