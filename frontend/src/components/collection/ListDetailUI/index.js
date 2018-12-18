import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import ListEntry from 'components/collection/ListEntry';


class ListDetailUI extends PureComponent {
  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    list: PropTypes.object
  }

  render() {
    const { auth, collection, list } = this.props;
    const canAdmin = auth.getIn(['user', 'username']) === collection.get('owner');
    return (
      <div className="list-detail">
        <ListEntry isDetail {...{ canAdmin, collection, list }} />
      </div>
    );
  }
}


export default ListDetailUI;
