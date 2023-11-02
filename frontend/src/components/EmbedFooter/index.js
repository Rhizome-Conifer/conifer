import React from 'react';
import PropTypes from 'prop-types';

import config from 'config';

import TimeFormat from 'components/TimeFormat';

import './style.scss';


function EmbedFooter({ timestamp }) {
  return (
    <div className="embed-footer">
      <span>This is an archived page from <TimeFormat dt={timestamp} /></span>
      <div>Archived with <a target="_blank" href={config.productLink}>{config.product}</a></div>
    </div>
  );
}


EmbedFooter.propTypes = {
  timestamp: PropTypes.string
};

export default EmbedFooter;
