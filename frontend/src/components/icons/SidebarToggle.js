import React from 'react';
import PropTypes from 'prop-types';


function SidebarToggle(props) {
  const { flip } = props;
  const styleProp = flip ? { transform: 'rotateZ(180deg)' } : {};

  return (
    <svg width="11px" height="11px" viewBox="0 0 11 11" version="1.1" xmlns="http://www.w3.org/2000/svg" style={styleProp}>
      <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
        <g id="03-Nav-Rollover-States" transform="translate(-283.000000, -100.000000)" fill="#484848">
          <path d="M293.5,101.914214 L289.914089,105.500125 L293.5,109.086036 L293.5,110.500249 L288.5,105.500249 L288.500125,105.500125 L288.5,105.5 L293.5,100.5 L293.5,101.914214 Z M288.5,101.914214 L284.914089,105.500125 L288.5,109.086036 L288.5,110.500249 L283.5,105.500249 L288.5,100.5 L288.5,101.914214 Z" id="minimize_sidebar_ico" />
        </g>
      </g>
    </svg>
  );
}

SidebarToggle.propTypes = {
  flip: PropTypes.bool
};

export default SidebarToggle;
