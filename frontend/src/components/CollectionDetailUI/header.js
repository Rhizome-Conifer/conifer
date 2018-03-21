import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { defaultCollDesc } from 'config';

import WYSIWYG from 'components/WYSIWYG';
import { PencilIcon } from 'components/icons';


class CollDetailHeader extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  }

  static propTypes = {
    activeList: PropTypes.bool,
    collection: PropTypes.object,
    list: PropTypes.object,
    saveDescription: PropTypes.func,
    saveSuccess: PropTypes.bool
  };

  _saveDesc = (desc) => {
    const { activeList, collection, list, saveDescription } = this.props;
    if (activeList) {
      saveDescription(collection.get('user'), collection.get('id'), desc, list.get('id'));
    } else {
      saveDescription(collection.get('user'), collection.get('id'), desc);
    }
  }

  render() {
    const { activeList, collection, list } = this.props;

    return (
      <header>
        <h1>{collection.get('title')}{activeList ? ` > ${list.get('title')}` : null }</h1>
        <hr />
        <div className="desc-container">
          <WYSIWYG
            initial={activeList ? list.get('desc') : collection.get('desc') || defaultCollDesc}
            save={this._saveDesc}
            success={this.props.saveSuccess} />
        </div>
      </header>
    );
  }
}


export default CollDetailHeader;
