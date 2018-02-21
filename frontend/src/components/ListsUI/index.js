import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Collapsible from 'react-collapsible';

import ListItem from './ListItem';

import './style.scss';


class ListsUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    loaded: PropTypes.bool,
    loading: PropTypes.bool,
    lists: PropTypes.object,
    list: PropTypes.object,
    listId: PropTypes.string,
    getLists: PropTypes.func
  };

  editLists = (evt) => {
    evt.stopPropagation();
  }

  render() {
    const { canAdmin } = this.context;
    const { collection, list, lists, listId } = this.props;

    const listItems = lists.entrySeq();

    // wait until collection is loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const collapsibleHeader = (
      <header className="lists-header">
        <div>
          <span className="glyphicon glyphicon-triangle-right" />
          <h4>Lists</h4>
        </div>
        {
          canAdmin &&
            <button onClick={this.editLists} className="button-link list-edit">EDIT</button>
        }
      </header>
    );

    return (
      <div className="wr-coll-sidebar">
        <header>Collection Navigator <span role="button" className="sidebar-minimize" onClick={this.minimize}>-</span></header>

        {
          list &&
            <Link to={`/${collection.get('user')}/${collection.get('id')}`} className="button-link">See All Resouces in Collection</Link>
        }

        <div className="lists-body">
          <Collapsible
            lazyRender
            open
            easing="ease-out"
            trigger={collapsibleHeader}>
            <ul>
              {
                listItems.map(listObj => (
                  <ListItem
                    key={listObj[0]}
                    selected={list && listObj[0] === list.get('id')}
                    id={listObj[0]}
                    list={listObj[1]}
                    collection={collection} />
                ))
              }
            </ul>
          </Collapsible>

          <button>+ new list</button>
        </div>
      </div>
    );
  }
}

export default ListsUI;
