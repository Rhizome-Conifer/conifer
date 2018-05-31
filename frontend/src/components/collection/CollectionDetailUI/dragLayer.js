import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DragLayer } from 'react-dnd';

import { draggableTypes } from 'config';


const getItemStyles = ({ initialOffset, currentOffset, initialClientOffset, clientOffset }) => {
  if (!initialOffset || !currentOffset) {
    return {
      display: 'none'
    };
  }

  return {
    top: clientOffset.y + 10,
    left: clientOffset.x + 10
  };
};

class CustomDragLayer extends Component {
  static propTypes = {
    item: PropTypes.object,
    isDragging: PropTypes.bool,
    itemType: PropTypes.string,
    pages: PropTypes.object,
    pageSelection: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.number,
      PropTypes.object // null
    ])
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    const { isDragging, item, itemType, pages, pageSelection } = nextProps;

    if (isDragging && !prevState.isDragging) {
      const selType = typeof pageSelection;

      let pageIds = [];
      if (selType === 'object' && pageSelection !== null) {
        pageIds = pageSelection.map(pg => pages.get(pg).get('id'));
      }

      return {
        count: pageIds.includes(item.id) ? pageIds.length : 1,
        isDragging
      };
    } else if (!isDragging && prevState.isDragging) {
      return {
        count: 0,
        isDragging
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.types = [
      draggableTypes.PAGE_ITEM,
      draggableTypes.BOOKMARK_ITEM
    ];

    this.state = {
      count: 0,
      isDragging: props.isDragging
    };
  }

  render() {
    const { isDragging, itemType, pageSelection } = this.props;

    if (!isDragging) {
      return null;
    }

    if (!this.types.includes(itemType)) {
      return null;
    }

    if (itemType === draggableTypes.BOOKMARK_ITEM &&
       (typeof pageSelection === 'number' || pageSelection === null)) {
      return null;
    }

    return (
      <div className="drag-preview" style={getItemStyles(this.props)}>
        + {this.state.count}
      </div>
    );
  }
}


const collect = (monitor) => {
  return {
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    initialOffset: monitor.getInitialSourceClientOffset(),
    currentOffset: monitor.getSourceClientOffset(),
    initialClientOffset: monitor.getInitialClientOffset(),
    clientOffset: monitor.getClientOffset(),
    isDragging: monitor.isDragging()
  };
};


export default DragLayer(collect)(CustomDragLayer);
