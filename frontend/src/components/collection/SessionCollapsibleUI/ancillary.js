import React from 'react';
import PropTypes from 'prop-types';

import config from 'config';

function DateHeader(props) {
  const date = new Date(props.dt);
  return (
    <div className="date-header">
      <span className="dom">{date.getDate()}</span>
      <span className="mon semi">{config.months[date.getMonth()]}</span>
      <span className="dow">{config.dow[date.getDay()]}</span>
      <span className="year semi">{date.getFullYear()}</span>
    </div>
  );
}

DateHeader.propTypes = {
  dt: PropTypes.string.isRequired,
};

export {
  DateHeader
};
