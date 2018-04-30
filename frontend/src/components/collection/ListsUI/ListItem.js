import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { DragSource, DropTarget } from 'react-dnd';

import { draggableTypes as dt } from 'config';


const listSource = {
  beginDrag({ index, list }) {
    return {
      id: list.get('id'),
      idx: index,
      initialIdx: index
    };
  },
  isDragging(props, monitor) {
    return props.list.get('id') === monitor.getItem().id;
  },
  endDrag(props, monitor) {
    const { idx, initialIdx } = monitor.getItem();

    if (!monitor.didDrop() && props.sort) {
      props.sort(idx, initialIdx);
    }
  }
};

const listTarget = {
  hover(props, monitor) {
    if (monitor.getItemType() === dt.LIST) {
      const origIndex = monitor.getItem().idx;
      const hoverIndex = props.index;

      // Don't replace items with themselves
      if (origIndex === hoverIndex) {
        return;
      }

      // Time to actually perform the action
      props.sort(origIndex, hoverIndex);

      monitor.getItem().idx = hoverIndex;
    }
  },
  drop(props, monitor) {
    const { item } = monitor.getItem();
    const itemType = monitor.getItemType();

    switch(itemType) {
      case dt.PAGE_ITEM:
        props.addToList(
          props.collection.get('user'),
          props.collection.get('id'),
          props.list.get('id'),
          item
        );
        break;
      case dt.LIST:
        props.saveSort();
        break;
      default:
        break;
    }
  }
};

function dropCollect(connect, monitor) {
  const isOver = monitor.isOver() && monitor.getItemType() === dt.PAGE_ITEM;
  return {
    connectDropTarget: connect.dropTarget(),
    isOver
  };
}

function dragCollect(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging()
  };
}


class ListItem extends PureComponent {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    addToList: PropTypes.func,
    collection: PropTypes.object,
    connectDragSource: PropTypes.func,
    connectDropTarget: PropTypes.func,
    editList: PropTypes.func,
    id: PropTypes.string,
    isDragging: PropTypes.bool,
    isOver: PropTypes.bool,
    list: PropTypes.object,
    selected: PropTypes.bool
  };

  editVisibility = () => {
    const { list } = this.props;
    this.props.editList(list.get('id'), { public: !list.get('public') });
  }

  render() {
    const { canAdmin } = this.context;
    const { collection, connectDragSource, connectDropTarget, isOver, isDragging, list, selected } = this.props;

    const classes = classNames({ selected, targeted: isOver });
    const isPublic = list.get('public');
    const title = list.get('title');

    const item = (
      <li className={classes} key={list.get('id')} style={{ opacity: isDragging ? 0 : 1 }}>
        <div className="wrapper">
          <Link to={`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}`} title={list.get('title')}>
            <span>{ list.get('title') }</span>
          </Link>
          {
            canAdmin &&
              <button
                aria-label={isPublic ? `set list '${title}' public` : `set list '${title}' private`}
                onClick={this.editVisibility}
                className={classNames('visiblity-toggle', { public: isPublic })}
                title="Toggle list visibility" />
          }
        </div>
      </li>
    );

    if (canAdmin) {
      return connectDragSource(connectDropTarget(item));
    }

    return item;
  }
}

export default DropTarget(
  [dt.PAGE_ITEM, dt.LIST],
  listTarget,
  dropCollect
)(DragSource(dt.LIST, listSource, dragCollect)(ListItem));
