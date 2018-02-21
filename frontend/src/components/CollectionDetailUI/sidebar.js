import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Lists } from 'containers';

import Resizable from 'components/Resizable';


class CollectionSidebar extends Component {
  static propTypes = {
    collection: PropTypes.object,
    list: PropTypes.object
  };

  render() {
    const { list } = this.props;

    return (
      <Resizable classes="wr-coll-sidebar-container">
        <div className="wr-coll-sidebar-stretch">
          <Lists list={list} />

          <div className="wr-coll-sidebar">
            meta info sidebar
          </div>
        </div>
      </Resizable>
    );
  }
}

export default CollectionSidebar;
