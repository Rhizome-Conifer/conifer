import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { AccessContext } from 'store/contexts';

import Searchbox from 'components/Searchbox';


class CollectionFiltersUI extends PureComponent {
  static contextType = AccessContext;

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
    const newSearch = this.context.canAdmin && ['admin', 'beta-archivist'].includes(this.props.user.get('role'));
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
        {
          this.props.searched && this.props.collection.get('pages').size === 5000 &&
            <div className="big-query-warning">This query returned over 5k results, try narrowing it with the search filters...</div>
        }
      </div>
    );
  }
}

export default CollectionFiltersUI;
