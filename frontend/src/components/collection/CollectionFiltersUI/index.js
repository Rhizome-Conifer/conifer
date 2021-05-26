import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { AccessContext } from 'store/contexts';

import Searchbox from 'components/Searchbox';


class CollectionFiltersUI extends PureComponent {
  static contextType = AccessContext;

  static propTypes = {
    clearIndexingState: PropTypes.func,
    clearSearch: PropTypes.func,
    collection: PropTypes.object,
    disabled: PropTypes.bool,
    history: PropTypes.object,
    loadMeta: PropTypes.func,
    location: PropTypes.object,
    searching: PropTypes.bool,
    searched: PropTypes.bool,
    searchCollection: PropTypes.func,
    user: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.count = 0;

    if (props.collection.get('indexing')) {
      this.interval = setInterval(() => {
        if (this.count++ > 60) {
          clearInterval(this.interval);
          props.clearIndexingState();
        } else {
          props.loadMeta(props.user.get('username'), props.collection.get('id'));
        }
      }, 1000);
    }
  }

  componentDidUpdate(prevProps) {
    const { collection, indexing, loadMeta, user } = this.props;

    if (!prevProps.indexing && indexing) {
      this.count = 0;
      this.interval = setInterval(() => {
        if (this.count++ > 240) {
          clearInterval(this.interval);
          this.props.clearIndexingState();
        } else {
          loadMeta(user.get('username'), collection.get('id'));
        }
      }, 1000);
    }

    if (prevProps.indexing && !indexing) {
      clearInterval(this.interval);
    }
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  search = (user, coll, params, fullText) => {
    this.props.searchCollection(user, coll, params, fullText && this.context.canAdmin);
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
            busy={this.props.searching || this.props.indexing}
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
