import React from 'react';
import PropTypes from 'prop-types';

import { HandleIcon } from 'components/icons';

import './style.scss';


function SidebarHeader(props) {
  const { label, callback, closed, collapsible } = props;
  return (
    <header
      role={collapsible ? 'button' : 'presentation'}
      className="sidebar-header"
      onClick={callback}
      title={`Minimize ${label}`}>
      <h4>{label}</h4>
      {
        collapsible &&
          <HandleIcon closed={closed} />
      }
    </header>
  );
}


SidebarHeader.propTypes = {
  callback: PropTypes.func,
  closed: PropTypes.bool,
  collapsible: PropTypes.bool,
  label: PropTypes.string
};

SidebarHeader.defaultProps = {
  collapsible: false
};

export default SidebarHeader;
