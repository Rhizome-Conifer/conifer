import { createStore, applyMiddleware, compose } from 'redux';
import createSagaMiddleware from 'redux-saga';

import reducers from './reducers';


// attach devtools if they exist or noop
const devtools = window.devToolsExtension || (() => noop => noop);

const sagaMiddleware = createSagaMiddleware();

const middlewares = [
  sagaMiddleware,
];

const enhancers = [
  applyMiddleware(...middlewares),
  devtools(),
];

const initialState = {};

const store = createStore(
  reducers,
  initialState,
  compose(...enhancers),
);

store.runSaga = sagaMiddleware.run;

export default store;