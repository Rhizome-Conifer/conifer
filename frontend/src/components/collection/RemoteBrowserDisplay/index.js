import React from 'react';
import PropTypes from 'prop-types';

import { capitalize } from 'helpers/utils';


function RemoteBrowserDisplay({ browser }) {
  if (!browser) {
    return null;
  }

  const browserName = capitalize(browser.get('name'));
  const browserVrs = browser.get('version');
  return (
    <span>
      <img src={`/api/browsers/browsers/${browser.get('id')}/icon`} alt={`Recorded with ${browserName} version ${browserVrs}`} />
      {` ${browserName} v${browserVrs}`}
    </span>
  );
}


RemoteBrowserDisplay.propTypes = {
  browser: PropTypes.object
};

export default RemoteBrowserDisplay;
