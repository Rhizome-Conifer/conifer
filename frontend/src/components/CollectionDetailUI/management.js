import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';

import Searchbox from 'components/Searchbox';

import 'shared/scss/toggle.scss';


function CollectionManagement(props, context) {
  const { canAdmin, isAnon } = context;
  const { expandAll, groupDisplay, activeList, onToggle, openAddToList,
          toggleExpandAllSessions, search, searchText, selectedPages } = props;

  return (
    <nav>
      {
        canAdmin &&
          <span className="glyphicon glyphicon-download" />
      }
      {
        canAdmin &&
          <span className="glyphicon glyphicon-upload" />
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

export {
  CollectionManagement
};
