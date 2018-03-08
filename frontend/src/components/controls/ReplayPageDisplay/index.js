import React from 'react';
import PropTypes from 'prop-types';

function ReplayPageDisplay(props) {
  const { index, total } = props;

  const value = `${index + 1} of ${total}`;

  return (
    <input type="text" id="page-display" className="form-control hidden-sm hidden-xs" title="Bookmark index" size={value.length} value={value} readOnly />
  );
}

ReplayPageDisplay.propTypes = {
  index: PropTypes.number,
  total: PropTypes.number
};

export default ReplayPageDisplay;
