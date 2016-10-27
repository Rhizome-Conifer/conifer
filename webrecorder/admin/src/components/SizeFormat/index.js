import React, { PropTypes } from 'react';

export function bytesToMb(bytes) {
  return bytes / 1000000;
}

function mbToGb(mb) {
  return mb / 1000;
}

function SizeFormat(props) {
  let display = '0 bytes';

  if(props.bytes) {
    const mb = bytesToMb(props.bytes);

    if(mb >= 1000) {
      display = `${mbToGb(mb).toFixed(2)} GB`;
    } else {
      display = `${mb.toFixed(2)} MB`;
    }
  }

  return (
    <span className={props.className}>{display}</span>
  );
}

SizeFormat.propTypes = {
  bytes: PropTypes.number,
  className: PropTypes.string,
};

export default SizeFormat;
