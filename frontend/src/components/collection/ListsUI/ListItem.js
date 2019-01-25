import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { DragSource, DropTarget } from 'react-dnd';
import { withRouter } from 'react-router';

import { draggableTypes as dt } from 'config';

import VisibilityLamp from 'components/collection/VisibilityLamp';
import { LoaderIcon } from 'components/icons';


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
      case dt.BOOKMARK_ITEM:
      case dt.PAGE_ITEM:
        props.dropCallback(item, props.list.get('id'), itemType);
        return {
          target: 'lists'
        };
      case dt.LIST:
        props.saveSort();
        break;
      default:
        break;
    }
  }
};

function dropCollect(connect, monitor) {
  const isOver = monitor.isOver() &&
                 [dt.PAGE_ITEM, dt.BOOKMARK_ITEM].includes(monitor.getItemType());
  return {
    connectDropTarget: connect.dropTarget(),
    isOver
  };
}

function dragCollect(connect, monitor) {
  return {
    connectDragPreview: connect.dragPreview(),
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
    bulkAdding: PropTypes.bool,
    collId: PropTypes.string,
    collPublic: PropTypes.bool,
    collUser: PropTypes.string,
    connectDragSource: PropTypes.func,
    connectDropTarget: PropTypes.func,
    editList: PropTypes.func,
    history: PropTypes.object,
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

  navigate = () => {
    const { collId, collUser, history, list } = this.props;
    history.push(`/${collUser}/${collId}/list/${list.get('slug')}/manage`);
  }

  render() {
    const { canAdmin } = this.context;
    const { bulkAdding, collPublic, connectDragSource, connectDropTarget, isOver, isDragging, list, selected } = this.props;

    const title = list.get('title');
    const isPublic = list.get('public');
    const classes = classNames({ selected, targeted: isOver, 'is-public': isPublic, movable: canAdmin });

    const item = (
      <li className={classes} key={list.get('id')} style={{ opacity: isDragging ? 0 : 1 }}>
        <div className={classNames('wrapper', { editable: canAdmin })} onClick={this.navigate}>
          <span className="title" title={list.get('title')}>
            { list.get('title') }
          </span>
          <span className="bookmark-count">{bulkAdding === list.get('id') ? <LoaderIcon /> : list.get('total_bookmarks')}</span>
          {
            canAdmin &&
              <VisibilityLamp
                callback={this.editVisibility}
                collPublic={collPublic}
                isPublic={isPublic}
                label={`list '${title}'`} />
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

export default withRouter(DropTarget(
  [dt.BOOKMARK_ITEM, dt.PAGE_ITEM, dt.LIST],
  listTarget,
  dropCollect
)(DragSource(dt.LIST, listSource, dragCollect)(ListItem)));
