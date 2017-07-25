import React from 'react';
import PropTypes from 'prop-types';

function TimeFormat(props) {
  const { dt, epoch } = props;
  let displayTime;

  if(dt) {
    let sDt = String(dt);

    if(sDt.length < 14)
      sDt += '10000101000000'.substr(sDt.length);

    const datestr = (sDt.substring(0, 4) + '-' +
                  sDt.substring(4, 6) + '-' +
                  sDt.substring(6, 8) + 'T' +
                  sDt.substring(8, 10) + ':' +
                  sDt.substring(10, 12) + ':' +
                  sDt.substring(12, 14) + '-00:00');

    const date = new Date(datestr);
    displayTime = date.toGMTString();
  } else if(epoch) {
    displayTime = new Date(epoch * 1000).toLocaleString();
  }

  return (
    <span>
      { displayTime }
    </span>
  );
}

TimeFormat.propTypes = {
  dt: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  epoch: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
};

TimeFormat.defaultProps = {
  dt: false,

}

export default TimeFormat;
