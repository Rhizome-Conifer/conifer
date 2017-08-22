import React, { Component } from 'react';
import PropTypes from 'prop-types';
import find from 'lodash/find';

import { DropdownButton, MenuItem } from 'react-bootstrap';

import './style.scss';


class CollectionDropdownUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.object,
    activeCollection: PropTypes.object,
    setCollection: PropTypes.func
  }

  collectionChoice = (id) => {
    this.props.setCollection(id);
  }

  render() {
    const { auth, collections, activeCollection } = this.props;

    const user = auth.get('user');
    const buttonTitle = activeCollection.title ? activeCollection.title : 'Choose a collection';

    return (
      <div className="wr-collection-menu">
        {
          user && user.get('username') && !user.get('anon') &&
            <div>
              <label className="left-buffer" htmlFor="collection">Add to collection:&emsp;</label>
              <DropdownButton title={buttonTitle} id="wr-collecton-dropdown" onSelect={this.collectionChoice}>
                <MenuItem>+ Create new collection</MenuItem>
                <MenuItem divider />
                {
                  collections.map((coll) => {
                    const id = coll.get('id');
                    const title = coll.get('title');

                    return (
                      <MenuItem
                        key={id}
                        eventKey={id}
                        className={title.length > 50 ? 'make-wrap' : ''}
                        active={activeCollection.id === id}>
                        { title }
                      </MenuItem>
                    );
                  })
                }
              </DropdownButton>
            </div>
        }
      </div>
    );
  }
}

export default CollectionDropdownUI;
