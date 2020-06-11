import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import Searchbox from 'components/Searchbox';


class CollectionFiltersUI extends PureComponent {
  static propTypes = {
    clearSearch: PropTypes.func,
    collection: PropTypes.object,
    disabled: PropTypes.bool,
    history: PropTypes.object,
    location: PropTypes.object,
    searching: PropTypes.bool,
    searched: PropTypes.bool,
    searchCollection: PropTypes.func,
    user: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.indexed = false;
  }

  search = (user, coll, params, fullText) => {
    const newSearch = this.context.canAdmin && ['admin', 'beta-archivist'].includes(this.props.user.get('role'))
    this.props.searchCollection(user, coll, params, fullText && newSearch);
  }

  render() {
    return (
      <div className="wr-coll-utilities">
        <nav>
          <Searchbox
            collection={this.props.collection}
            history={this.props.history}
            location={this.props.location}
            search={this.search}
            clear={this.props.clearSearch}
            searching={this.props.searching}
            searched={this.props.searched} />
        </nav>
      </div>
    );
  }
}

export default CollectionFiltersUI;
