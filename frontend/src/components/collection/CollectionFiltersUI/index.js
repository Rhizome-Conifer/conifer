import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { QueryBox } from 'containers';

import Searchbox from 'components/Searchbox';


class CollectionFiltersUI extends PureComponent {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    clearSearch: PropTypes.func,
    collection: PropTypes.object,
    disabled: PropTypes.bool,
    querying: PropTypes.bool,
    searching: PropTypes.bool,
    searched: PropTypes.bool,
    searchCollection: PropTypes.func,
    setPageQuery: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.indexed = false;
  }

  search = (searchParams) => {
    const { collection, searchCollection } = this.props;
    searchCollection(collection.get('owner'), collection.get('id'), searchParams);
  }

  query = (queryColumn) => {
    this.props.setPageQuery(queryColumn);
  }

  render() {
    return (
      <div className="wr-coll-utilities">
        <nav>
          {
            this.props.querying ?
              <QueryBox /> :
              <Searchbox
                collection={this.props.collection}
                query={this.query}
                search={this.search}
                clear={this.props.clearSearch}
                searching={this.props.searching}
                searched={this.props.searched} />
          }
        </nav>
      </div>
    );
  }
}

export default CollectionFiltersUI;
