import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { DropTarget } from 'react-dnd';

import { draggableTypes } from 'config';

import { BrowserIcon } from 'components/icons';


const listTarget = {
  drop(props, monitor) {
    const item = monitor.getItem();

    props.addToList(
      props.collection.get('user'),
      props.collection.get('id'),
      props.list.get('id'),
      item
    );
  }
};

function collect(connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver()
  };
}

function ListItem({ collection, connectDropTarget, isOver, list, selected }) {
  const classes = classNames({ selected, targeted: isOver });
  return connectDropTarget(
    <li className={classes} key={list.get('id')}>
      <div className="wrapper">
        <BrowserIcon />
        <Link to={`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}`}>
          <span>{ list.get('title') }</span>
        </Link>
      </div>
    </li>
  );
}

ListItem.propTypes = {
  addToList: PropTypes.func,
  collection: PropTypes.object,
  id: PropTypes.string,
  list: PropTypes.object,
  selected: PropTypes.bool
};

export default DropTarget(draggableTypes.PAGE_ITEM, listTarget, collect)(ListItem);
