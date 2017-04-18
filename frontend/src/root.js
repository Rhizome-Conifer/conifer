import React from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { Router } from 'react-router';
import { ReduxAsyncConnect } from 'redux-connect';


function Root(props) {
  const { client, history, routes, store } = props;

  return (
    <Provider store={store} key="provider">
      <Router
        key={module.hot && new Date()}
        history={history}
        routes={routes}
        render={props =>
          <ReduxAsyncConnect
            {...props}
            helpers={{ client }}
            filter={item => !item.deferred}
          />
        }
      />
    </Provider>
  );
}

Root.propTypes = {
  client: PropTypes.object.isRequired,
  store: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  routes: React.PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]).isRequired
};

export default Root;
