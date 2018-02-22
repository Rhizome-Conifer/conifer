import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';

import { BrowserIcon } from 'components/icons';


function ListItem({ collection, id, list, selected }) {
  const classes = classNames({ selected });
  return (
    <li className={classes} key={id}>
      <div className="wrapper">
        <BrowserIcon />
        <Link to={`/${collection.get('user')}/${collection.get('id')}/list/${id}`}>
          <span>{ list.get('title') }</span>
        </Link>
      </div>
    </li>
  );
}

ListItem.propTypes = {
  collection: PropTypes.object,
  id: PropTypes.string,
  list: PropTypes.object,
  selected: PropTypes.bool
};

export default ListItem;
