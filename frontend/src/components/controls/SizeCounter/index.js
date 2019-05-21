import React from 'react';
import PropTypes from 'prop-types';

import SizeFormat from 'components/SizeFormat';

import './style.scss';


const SizeCounterUI = React.memo(({ bytes, classes }) => {
  return (
    <span className="size-counter">
      <span className={`badge ${classes}`}>
        <SizeFormat bytes={bytes} />
      </span>
    </span>
  );
});

SizeCounterUI.propTypes = {
  bytes: PropTypes.number,
};

export default SizeCounterUI;
