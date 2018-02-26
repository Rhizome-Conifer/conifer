import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Lists } from 'containers';

import Resizable from 'components/Resizable';


class CollectionSidebar extends Component {
  static propTypes = {
    collection: PropTypes.object,
    activeList: PropTypes.string
  };

  render() {
    const { activeList } = this.props;

    return (
      <Resizable classes="wr-coll-sidebar-container">
        <div className="wr-coll-sidebar-stretch">
          <Lists activeList={activeList} />

          <div className="wr-coll-sidebar">
            meta info sidebar
          </div>
        </div>
      </Resizable>
    );
  }
}

export default CollectionSidebar;
