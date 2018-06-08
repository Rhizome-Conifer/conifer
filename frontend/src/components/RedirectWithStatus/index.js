import React from 'react';
import { Route } from 'react-router-dom';
import { Redirect } from 'react-router-dom';


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
