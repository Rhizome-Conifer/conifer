import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Lists } from 'containers';

import Resizable from 'components/Resizable';


class CollectionSidebar extends Component {
  static propTypes = {
    collection: PropTypes.object,
    activeListId: PropTypes.string
  };

  render() {
    const { activeListId } = this.props;

    return (
      <Resizable classes="wr-coll-sidebar-container" minWidth={160}>
        <div className="wr-coll-sidebar-stretch">
          <Resizable axis="y" minHeight={200} storageKey="collNavigator">
            <Lists activeListId={activeListId} />
          </Resizable>
          <div style={{ flexGrow: 1 }}>
            Inspector Panel
          </div>
        </div>
      </Resizable>
    );
  }
}

export default CollectionSidebar;
