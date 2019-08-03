import React from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter } from 'react-router-dom';
import { Router, MemoryRouter } from 'react-router';
import { ReduxAsyncConnect } from 'redux-connect';
import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';

const { ipcRenderer } = window.require('electron');


function Root(props) {
  const { client, routes } = props;

  return __DESKTOP__ ?
    (
      <Router history={createCustomHistory()}>
        <ReduxAsyncConnect routes={routes} helpers={{ client }} />
      </Router>
    ) :
    (
      <BrowserRouter>
        <ReduxAsyncConnect routes={routes} helpers={{ client }} />
      </BrowserRouter>
    );
}

function createCustomHistory() {
  const getUserConfirmation = function(result, callback) {
    if (result === 'wait') {
      ipcRenderer.send('unload-wait');
      ipcRenderer.once('unload-resume', () => callback(true));
      return;
    }

    callback(true);
  }

  return createMemoryHistory({ getUserConfirmation });
  //return createMemoryHistory();
}

Root.propTypes = {
  client: PropTypes.object.isRequired,
  routes: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]).isRequired
};

export default Root;
