import React, { Component } from 'react';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import 'shared/scss/dropdown.scss';


class CollectionDropdown extends Component {

  render() {
    return (
      <span className="dropdown">
        <DropdownButton id="collection-dropdown" title={'Default coll'} bsStyle="default">
          <MenuItem eventKey="0"><span className="glyphicon glyphicon-plus right-buffer-sm" /> Create New Collection</MenuItem>
          <MenuItem divider />
          <MenuItem eventKey="1">collection</MenuItem>
        </DropdownButton>
      </span>
    );
  }
}

export default CollectionDropdown;
