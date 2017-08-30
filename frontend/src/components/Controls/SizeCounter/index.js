import React from 'react';
import PropTypes from 'prop-types';

import SizeFormat from 'components/SizeFormat';

function SizeCounter(props) {
  const { bytes, classes } = props;

  return (
    <span className="size-counter">
      <span className={`badge ${classes}`}>
        <SizeFormat {...props} />
      </span>
    </span>
  );
}

SizeCounter.propTypes = {
  bytes: PropTypes.number,
};

export default SizeCounter;
