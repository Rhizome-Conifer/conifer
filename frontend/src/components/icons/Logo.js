import React from 'react';


function LogoIcon({ darkMode }) {
  return (
    <svg width="120px" height="139px" viewBox="0 0 120 139" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <g stroke="none" strokeWidth="1" fill="none" fillRule="nonzero">
        {
          darkMode ?
            <path d="M59.7609562,4 C92.7660209,4 119.521912,30.5120106 119.521912,63.216233 L119.521912,139.059761 L65.899,139.059 L65.8776188,108.909644 L92.1389317,113.942207 L59.8795479,44.7625615 L27.048961,114.302465 L53.2074783,108.894615 L53.237,139.059 L0,139.059761 L0,63.216233 C0,30.5120106 26.7558914,4 59.7609562,4 Z" fill="#FFFFFF" /> :
            <g transform="translate(-97,-77)" fillRule="evenodd" fill="none" strokeWidth="1" stroke="none">
              <path fill="#000000" d="m 157,77 c 33.13709,0 60,26.90874 60,60.10236 v 76.97846 h -53.96526 l -0.0219,-30.42202 26.33938,5.09713 -32.35528,-70.06715 -32.92819,70.43203 26.23628,-5.47723 0.03,30.43724 H 97 V 137.10236 C 97,103.90874 123.86291,77 157,77 Z" />
            </g>
        }
      </g>
    </svg>
  );
}

export default LogoIcon;
