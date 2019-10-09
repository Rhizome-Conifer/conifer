import React from 'react';
import RedirectWithStatus from 'components/RedirectWithStatus';


const Documentation = () => {
  return (
    <RedirectWithStatus from="/docs" to="/docs/api" />
  );
};

export default Documentation;
