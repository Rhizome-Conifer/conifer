import React from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

import Searchbox from 'components/Searchbox';

import 'shared/scss/toggle.scss';


function CollectionManagement(props, context) {
  const { canAdmin, isAnon } = context;
  const { collection, expandAll, groupDisplay, activeList, onToggle, openAddToList, toggleExpandAllSessions, search, searchText, selectedPages } = props;

  return (
    <nav>
      {
        canAdmin &&
          <Link to={`/${collection.get('user')}/${collection.get('id')}/$new`}>
            <Button bsSize="xs" bsStyle="success">New Recording</Button>
          </Link>
      }
      {
        !activeList &&
          <div className="toggle-label">
            <span onClick={onToggle}>Group by session</span>
            <Toggle
              checked={groupDisplay}
              onChange={onToggle}
              icons={false} />
          </div>
      }
      {
        !isAnon && canAdmin && selectedPages &&
          <button className="open-all" onClick={openAddToList}>Add selection to lists</button>
      }
      {
        groupDisplay &&
          <button className="open-all" onClick={toggleExpandAllSessions}>{expandAll ? 'Close' : 'Open'} All Sessions</button>
      }
      {
        !activeList &&
          <Searchbox search={search} searchText={searchText} />
      }
    </nav>
  );
}

CollectionManagement.propTypes = {
  collection: PropTypes.object,
  expandAll: PropTypes.bool,
  groupDisplay: PropTypes.bool,
  activeList: PropTypes.bool,
  onToggle: PropTypes.func,
  openAddToList: PropTypes.func,
  toggleExpandAllSessions: PropTypes.func,
  search: PropTypes.func,
  searchText: PropTypes.string,
  selectedPages: PropTypes.bool
};

CollectionManagement.contextTypes = {
  canAdmin: PropTypes.bool,
  isAnon: PropTypes.bool
};

export default CollectionManagement;
