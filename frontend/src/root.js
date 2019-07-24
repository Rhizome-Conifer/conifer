import React from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter } from 'react-router-dom';
import { MemoryRouter } from 'react-router';
import { ReduxAsyncConnect } from 'redux-connect';


function Root(props) {
  const { client, routes } = props;

  return __DESKTOP__ ?
    (
      <MemoryRouter>
        <ReduxAsyncConnect routes={routes} helpers={{ client }} />
      </MemoryRouter>
    ) :
    (
      <BrowserRouter>
        <ReduxAsyncConnect routes={routes} helpers={{ client }} />
      </BrowserRouter>
    );
}

Root.propTypes = {
  client: PropTypes.object.isRequired,
  routes: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]).isRequired
};

export default Root;
