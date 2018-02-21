import { fromJS } from 'immutable';

import { apiPath } from 'config';

const LISTS_LOAD = 'wr/lists/LISTS_LOAD';
const LISTS_LOAD_SUCCESS = 'wr/lists/LISTS_LOAD_SUCCESS';
const LISTS_LOAD_FAIL = 'wr/lists/LISTS_LOAD_FAIL';

const initialState = fromJS({
  loading: false,
  loaded: false,
  error: null,
  lists: []
});

export default function lists(state = initialState, action = {}) {
  switch (action.type) {
    case LISTS_LOAD:
      return state.merge({
        loading: true,
        loaded: false
      });
    case LISTS_LOAD_SUCCESS:
      return state.merge({
        loading: false,
        loaded: true,
        lists: action.result.lists
      });
    case LISTS_LOAD_FAIL:
      return state.set('error', true);
    default:
      return state;
  }
}

// export function load() {
//   return {
//     types: [LISTS_LOAD, LISTS_LOAD_SUCCESS, LISTS_LOAD_FAIL],
//     accessed: Date.now(),
//     promise: client => client.get(`${apiPath}/lists`)
//   };
// }

export function load() {
  return {
    type: LISTS_LOAD_SUCCESS,
    result: {
      lists: {
        1: {
          id: '1',
          name: 'My first list!',
          bookmarks: [
            {
              id: '1',
              url: 'http://example.com',
              timestamp: '20180217164801',
              title: 'example',
              state: 10
            },
            {
              id: '2',
              url: 'http://example.com',
              timestamp: '20180217162845',
              title: 'another example',
              state: 10
            },
            {
              id: '3',
              url: 'http://example.com',
              timestamp: '20180209021324',
              title: 'example again',
              state: 10
            },
            {
              id: '4',
              url: 'http://example.com',
              timestamp: '20180208224143',
              title: 'one last example',
              state: 10
            }
          ]
        },
        2: {
          id: '2',
          name: 'Another fun list!',
          bookmarks: [
            {
              id: '5',
              url: 'http://example.com',
              timestamp: '20180217164801',
              title: 'example',
              state: 10
            },
            {
              id: '6',
              url: 'http://example.com',
              timestamp: '20180217162845',
              title: 'another example',
              state: 10
            }
          ]
        }
      }
    }
  };
}
