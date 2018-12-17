import React, { Component } from 'react';
import PropTypes from 'prop-types';
import defaultRowRenderer from 'react-virtualized/dist/commonjs/Table/defaultRowRenderer';
import { DragSource, DropTarget } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

import { draggableTypes } from 'config';
import { keyIn } from 'helpers/utils';


const baseSource = {
  isDragging(props, monitor) {
    return props.id === monitor.getItem().id && typeof props.pageSelection !== 'object';
  }
};

const pageSource = {
  ...baseSource,
  beginDrag({ index, rowData }) {
    return {
      id: rowData.get('id'),
      idx: index,
      initialIdx: index,
      item: rowData.set('page_id', rowData.get('id')).filterNot(keyIn('id')).toJS()
    };
  }
};

const bookmarkSource = {
  ...baseSource,
  beginDrag({ index, rowData }) {
    return {
      id: rowData.get('id'),
      idx: index,
      initialIdx: index,
      item: rowData.filterNot(keyIn('id', 'page')).toJS()
    };
  },
  endDrag(props, monitor) {
    const { idx, initialIdx } = monitor.getItem();
    const res = monitor.getDropResult();
    const dropped = monitor.didDrop();

    // restore sort if lists were inteded drop target
    if (props.sort && (!dropped || (dropped && res && res.target === 'lists'))) {
      props.sort(idx, initialIdx);
    }
  }
};

const pageDropSource = {
  hover(props, monitor, component) {
    const origIndex = monitor.getItem().idx;
    const hoverIndex = props.index;

    // Don't replace items with themselves
    if (origIndex === hoverIndex) {
      return;
    }

    // don't sort for multi-select
    if (typeof props.pageSelection === 'object' && props.pageSelection !== null) {
      return;
    }

    // Time to actually perform the action
    props.sort(origIndex, hoverIndex);

    monitor.getItem().idx = hoverIndex;
  },
  drop(props, monitor) {
    props.save();
  }
};

function collect(connect, monitor) {
  return {
    connectDragPreview: connect.dragPreview(),
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging()
  };
}

function DefaultRow(props) {
  return defaultRowRenderer(props);
}


class DnDSortableRowBuilder extends Component {
  componentDidUpdate(prevProps) {
    const { pageSelection } = this.props;

    if (typeof pageSelection === 'object' && pageSelection !== null) {
      this.props.connectDragPreview(getEmptyImage());
    }
  }

  render() {
    const { connectDragPreview, connectDragSource, connectDropTarget, isDragging, ...passThrough } = this.props;

    passThrough.style = { ...passThrough.style, opacity: isDragging ? 0 : 1 };
    return connectDragPreview(connectDragSource(connectDropTarget(defaultRowRenderer(passThrough))));
  }
}

class DnDRowBuilder extends Component {
  static propTypes = {
    connectDragPreview: PropTypes.func,
    connectDragSource: PropTypes.func
  }

  componentDidMount() {
    this.props.connectDragPreview(getEmptyImage());
  }

  render() {
    const { connectDragSource, ...passThrough } = this.props;
    return connectDragSource(defaultRowRenderer(passThrough));
  }
}

const DnDRow = DragSource(draggableTypes.PAGE_ITEM, pageSource, collect)(DnDRowBuilder);

const DnDSortableRow = DropTarget(
  draggableTypes.BOOKMARK_ITEM,
  pageDropSource,
  connect => ({
    connectDropTarget: connect.dropTarget(),
  })
)(DragSource(draggableTypes.BOOKMARK_ITEM, bookmarkSource, collect)(DnDSortableRowBuilder));

export {
  DefaultRow,
  DnDRow,
  DnDSortableRow
};
