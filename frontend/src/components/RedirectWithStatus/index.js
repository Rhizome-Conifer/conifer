import React from 'react';
import Route from 'react-router-dom/Route';
import Redirect from 'react-router-dom/Redirect';


const RedirectWithStatus = ({ from, to, status }) => (
  <Route render={({ staticContext }) => {
    // SSR only
    if (staticContext) {
      staticContext.status = status;
    }
    return <Redirect from={from} to={to} />;
  }} />
);

export default RedirectWithStatus;
