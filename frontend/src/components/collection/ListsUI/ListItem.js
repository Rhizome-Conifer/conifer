import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { DropTarget } from 'react-dnd';

import { draggableTypes } from 'config';

import { BrowserIcon } from 'components/icons';


const listTarget = {
  drop(props, monitor) {
    const { item } = monitor.getItem();

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

class ListItem extends PureComponent {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    addToList: PropTypes.func,
    collection: PropTypes.object,
    connectDropTarget: PropTypes.func,
    editList: PropTypes.func,
    id: PropTypes.string,
    isOver: PropTypes.bool,
    list: PropTypes.object,
    selected: PropTypes.bool
  };

  _editVisibility = () => {
    const { list } = this.props;
    this.props.editList(list.get('id'), { public: list.get('public') === '1' ? '0' : '1' });
  }

  render() {
    const { canAdmin } = this.context;
    const { collection, connectDropTarget, isOver, list, selected } = this.props;

    const classes = classNames({ selected, targeted: isOver });
    const isPublic = list.get('public') === '1';

    return connectDropTarget(
      <li className={classes} key={list.get('id')}>
        <div className="wrapper">
          <BrowserIcon />
          <Link to={`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}`}>
            <span>{ list.get('title') }</span>
          </Link>
          {
            canAdmin &&
              <button onClick={this._editVisibility} className={classNames('visiblity-toggle', { public: isPublic })} />
          }
        </div>
      </li>
    );
  }
}

export default DropTarget(draggableTypes.PAGE_ITEM, listTarget, collect)(ListItem);
