import React from 'react';
import PropTypes from 'prop-types';

import SizeFormat from 'components/SizeFormat';

function SizeCounter(props) {
  const { bytes } = props;
  return (
    <span className="size-counter size-counter-active">
      <span className="left-buffer-md badge current-size">
        <SizeFormat {...props} />
      </span>
    </span>
  );
}

SizeCounter.propTypes = {
  bytes: PropTypes.number,
};

export default SizeCounter;
