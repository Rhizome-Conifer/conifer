import React from 'react';
import Route from 'react-router-dom/Route';


const SetStatus = ({ code, children }) => (
  <Route render={({ staticContext }) => {
    if (staticContext) {
      staticContext.status = code;
    }

    return children;
  }} />
);

export default SetStatus;
