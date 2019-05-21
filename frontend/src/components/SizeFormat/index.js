import React from 'react';
import PropTypes from 'prop-types';


const SizeFormat = React.memo(({ bytes }) => {
  let display = '0 bytes';

  if (isFinite(bytes) && bytes > 0) {
    const s = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const e = Math.floor(Math.log(bytes) / Math.log(1000));
    display = `${(bytes / Math.pow(1000, e)).toFixed(2)} ${s[e]}`;
  }

  return (
    <span>{ display }</span>
  );
});

SizeFormat.propTypes = {
  bytes: PropTypes.number
};

export default SizeFormat;
