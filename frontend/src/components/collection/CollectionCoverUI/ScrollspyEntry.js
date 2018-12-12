import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { ListIcon } from 'components/icons';


function ScrollspyEntry({ index, onSelect, selected, title }) {

  const onEvent = (evt) => {
    if ((evt.type === 'keyup' && evt.keyCode === 13) || evt.type === 'click') {
      onSelect(index);
    }
  };

  return (
    <li className={classNames({ selected })} onClick={onEvent} onKeyUp={onEvent} role="button" tabIndex="0">
      <h3><ListIcon />{title}</h3>
    </li>
  );
}


ScrollspyEntry.propTypes = {
  index: PropTypes.number,
  onSelect: PropTypes.func,
  selected: PropTypes.bool,
  title: PropTypes.string
};

export default ScrollspyEntry;
