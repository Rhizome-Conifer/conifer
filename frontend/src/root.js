import React from 'react';
import PropTypes from 'prop-types';
import { applyRouterMiddleware, Router } from 'react-router';
import { ReduxAsyncConnect } from 'redux-connect';
import { useScroll } from 'react-router-scroll';


function Root(props) {
  const { client, history, routes } = props;

  return (
    <Router
      key={module.hot && new Date()}
      history={history}
      routes={routes}
      render={renderProps =>
        <ReduxAsyncConnect
          {...renderProps}
          helpers={{ client }}
          filter={item => !item.deferred}
          render={applyRouterMiddleware(useScroll())} />
      } />
  );
}

Root.propTypes = {
  client: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  routes: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]).isRequired
};

export default Root;
