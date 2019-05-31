import React from 'react';
import PropTypes from 'prop-types';

import SizeFormat from 'components/SizeFormat';

import './style.scss';


const SizeCounterUI = React.memo((props) => {
  return (
    <span className="size-counter">
      <SizeFormat {...props} />
    </span>
  );
});

SizeCounterUI.propTypes = {
  bytes: PropTypes.number,
  classes: PropTypes.string
};

export default SizeCounterUI;
