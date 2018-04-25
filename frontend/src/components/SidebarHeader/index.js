import React from 'react';
import PropTypes from 'prop-types';

import { HandleIcon } from 'components/icons';

import './style.scss';


function SidebarHeader(props) {
  const { label, callback, closed } = props;
  return (
    <header
      role="button"
      className="sidebar-header"
      onClick={callback}
      title={`Minimize ${label}`}>
      <h4>{label}</h4><HandleIcon closed={closed} />
    </header>
  );
}


SidebarHeader.propTypes = {
  callback: PropTypes.func,
  closed: PropTypes.bool,
  label: PropTypes.string
};

export default SidebarHeader;
