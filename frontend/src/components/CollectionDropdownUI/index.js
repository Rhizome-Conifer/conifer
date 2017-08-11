import React, { Component } from 'react';
import PropTypes from 'prop-types';
import find from 'lodash/find';

import { DropdownButton, MenuItem } from 'react-bootstrap';


class CollectionDropdownUI extends Component {
  static propTypes = {
    collections: PropTypes.object,
    activeCollection: PropTypes.string,
    setCollection: PropTypes.func
  }

  collectionChoice = (id) => {
    this.props.setCollection(id);
  }

  render() {
    const { collections, activeCollection } = this.props;
    const title = activeCollection ? collections.find(coll => coll.get('id') === activeCollection).title : 'Choose a collection';

    return (
      <DropdownButton title={title} id="wr-collecton-dropdown" onSelect={this.collectionChoice}>
        <MenuItem>+ Create new collection</MenuItem>
        <MenuItem divider />
        {
          collections.map(coll => <MenuItem key={coll.get('id')} eventKey={coll.get('id')} active={activeCollection === coll.get('id')}>{ coll.get('title') }</MenuItem>)
        }
      </DropdownButton>
    );
  }
}

export default CollectionDropdownUI;
