import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { DropTarget } from 'react-dnd';

import { draggableTypes } from 'config';

import { FlagIcon } from 'components/icons';


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
    editColl: PropTypes.func,
    editList: PropTypes.func,
    id: PropTypes.string,
    isOver: PropTypes.bool,
    list: PropTypes.object,
    selected: PropTypes.bool
  };

  setFeaturedList = () => {
    const { collection, list } = this.props;
    this.props.editColl(collection.get('user'), collection.get('id'), { featured_list: list.get('id') });
  }

  editVisibility = () => {
    const { list } = this.props;
    this.props.editList(list.get('id'), { public: !list.get('public') });
  }

  render() {
    const { canAdmin } = this.context;
    const { collection, connectDropTarget, isOver, list, selected } = this.props;

    const classes = classNames({ selected, targeted: isOver });
    const isPublic = list.get('public');
    const title = list.get('title');

    return connectDropTarget(
      <li className={classes} key={list.get('id')}>
        <div className="wrapper">
          {
            canAdmin &&
              <button
                onClick={this.setFeaturedList}
                className={classNames('feature-list borderless', { featured: collection.get('featured_list') === list.get('id') })}>
                <FlagIcon />
              </button>
          }
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
  }
}

export default DropTarget(draggableTypes.PAGE_ITEM, listTarget, collect)(ListItem);
