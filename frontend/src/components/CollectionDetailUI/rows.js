import React from 'react';
import defaultRowRenderer from 'react-virtualized/dist/commonjs/Table/defaultRowRenderer';
import { DragSource } from 'react-dnd';
import { draggableTypes } from 'config';


const pageSource = {
  beginDrag({ rowData }) {
    return rowData.toJS();
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
  const { isDragging, connectDragSource, ...passThrough } = props;
  return props.connectDragSource(defaultRowRenderer(passThrough));
}

const DnDRow = DragSource(draggableTypes.PAGE_ITEM, pageSource, collect)(DnDRowBuilder);

export {
  DefaultRow,
  DnDRow
};
