import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { columns } from 'config';

import { QueryBox } from 'containers';

import Searchbox from 'components/Searchbox';


class CollectionFiltersUI extends PureComponent {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    disabled: PropTypes.bool,
    dispatch: PropTypes.func,
    isIndexing: PropTypes.bool,
    querying: PropTypes.bool,
    search: PropTypes.func,
    searching: PropTypes.bool,
    searchText: PropTypes.string,
    searchPages: PropTypes.func,
    setPageQuery: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.indexed = false;
  }

  search = (evt) => {
    const { dispatch, searchPages, setPageQuery } = this.props;

    const queryColumn = columns.find(c => evt.target.value.startsWith(`${c}:`));

    if (queryColumn) {
      // TODO: issue with batchActions and redux-search
      dispatch(searchPages(''));
      dispatch(setPageQuery(queryColumn));
    } else {
      dispatch(searchPages(evt.target.value));
    }
  }

  clearSearch = () => {
    const { dispatch, searchPages } = this.props;
    dispatch(searchPages(''));
  }

  render() {
    return (
      <div className="wr-coll-utilities">
        <nav>
          {
            this.props.querying ?
              <QueryBox /> :
              <Searchbox
                search={this.search}
                clear={this.clearSearch}
                disabled={this.props.disabled}
                searchText={this.props.searchText}
                searching={this.props.searching} />
          }
        </nav>
      </div>
    );
  }
}

export default CollectionFiltersUI;
