import React from 'react';
import PropTypes from 'prop-types';

import SizeFormat from 'components/SizeFormat';

function SizeCounterUI(props) {
  const { bytes, classes } = props;

  return (
    <span className="size-counter">
      <span className={`badge ${classes}`}>
        <SizeFormat {...props} />
      </span>
    </span>
  );
}

SizeCounterUI.propTypes = {
  bytes: PropTypes.number,
};

export default SizeCounterUI;
