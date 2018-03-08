import React from 'react';
import PropTypes from 'prop-types';


function DisplayFormat(props) {
  return (
    <div className="recording-time-info">
      { props.children }
    </div>
  );
}

function DurationFormat(props) {
  let { duration } = props;

  if (!duration || !['string', 'number'].includes(typeof duration)) {
    return duration;
  }

  if (typeof duration === 'string') {
    duration = parseInt(duration, 10);
  }

  // pluralize?
  const plrl = (num) => { return num > 1 ? 's' : '' };

  const years = Math.floor(duration / 31536000);
  if (years) {
    return (
      <DisplayFormat>{`${years} year${plrl(years)}`}</DisplayFormat>
    );
  }

  const days = Math.floor((duration %= 31536000) / 86400);
  if (days) {
    return (
      <DisplayFormat>{`${days} day${plrl(days)}`}</DisplayFormat>
    );
  }

  const hours = Math.floor((duration %= 86400) / 3600);
  if (hours) {
    return (
      <DisplayFormat>{`${hours} hour${plrl(hours)}`}</DisplayFormat>
    );
  }
  const minutes = Math.floor((duration %= 3600) / 60);
  if (minutes) {
    return (
      <DisplayFormat>{`${minutes} minute${plrl(minutes)}`}</DisplayFormat>
    );
  }

  const seconds = duration % 60;
  if (seconds) {
    return <DisplayFormat>{`${seconds} second${plrl(seconds)}`}</DisplayFormat>;
  }

  return <DisplayFormat>under a second</DisplayFormat>;
}

DurationFormat.propTypes = {
  duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default DurationFormat;
