import React from 'react';
import defaultRowRenderer from 'react-virtualized/dist/commonjs/Table/defaultRowRenderer';
import { DropTarget, DragSource } from 'react-dnd';
import { draggableTypes } from 'config';


const pageSource = {
  beginDrag({ index, rowData }) {
    return {
      id: rowData.get('id'),
      idx: index,
      initialIdx: index,
      item: rowData.toJS()
    };
  },
  isDragging(props, monitor) {
    return props.id === monitor.getItem().id;
  },
  endDrag(props, monitor) {
    const { idx, initialIdx } = monitor.getItem();

    if (!monitor.didDrop() && props.sort) {
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
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging()
  };
}

function DefaultRow(props) {
  return defaultRowRenderer(props);
}

function DnDRowBuilder(props) {
  const { connectDragSource, ...passThrough } = props;
  return connectDragSource(defaultRowRenderer(passThrough));
}

function DnDSortableRowBuilder(props) {
  const { isDragging, connectDragSource, connectDropTarget, ...passThrough } = props;
  passThrough.style = { ...passThrough.style, opacity: isDragging ? 0 : 1 };
  return connectDragSource(connectDropTarget(defaultRowRenderer(passThrough)));
}

const DnDRow = DragSource(draggableTypes.PAGE_ITEM, pageSource, collect)(DnDRowBuilder);

const DnDSortableRow = DropTarget(
  draggableTypes.PAGE_ITEM,
  pageDropSource,
  connect => ({
    connectDropTarget: connect.dropTarget(),
  })
)(DragSource(draggableTypes.PAGE_ITEM, pageSource, collect)(DnDSortableRowBuilder));

export {
  DefaultRow,
  DnDRow,
  DnDSortableRow
};
