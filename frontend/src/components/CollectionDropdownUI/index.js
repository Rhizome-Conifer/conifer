import React, { Component } from 'react';
import PropTypes from 'prop-types';
import find from 'lodash/find';

import { DropdownButton, MenuItem } from 'react-bootstrap';


class CollectionDropdownUI extends Component {
  static propTypes = {
    collections: PropTypes.array,
    activeCollection: PropTypes.string,
    setCollection: PropTypes.func
  }

  collectionChoice = (id) => {
    this.props.setCollection(id);
  }

  render() {
    const { collections, activeCollection } = this.props;
    const title = activeCollection ? find(collections, { id: activeCollection }).title : 'Choose a collection';

    return (
      <DropdownButton title={title} id="wr-collecton-dropdown" onSelect={this.collectionChoice}>
        <MenuItem>+ Create new collection</MenuItem>
        <MenuItem divider />
        {
          collections.map(coll => <MenuItem key={coll.id} eventKey={coll.id} active={activeCollection === coll.id}>{ coll.title }</MenuItem>)
        }
      </DropdownButton>
    );
  }
}

export default CollectionDropdownUI;
