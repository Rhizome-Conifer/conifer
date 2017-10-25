import React from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';


function CollectionManagement(props) {
  const { groupDisplay, onToggle, toggleExpandAllSessions } = props;
  return (
    <nav>
      <span className="glyphicon glyphicon-download" />
      <span className="glyphicon glyphicon-upload" />
      <span className="glyphicon glyphicon-th-list" />
      <div className="toggle-label">
        <span onClick={onToggle}>Group by session</span>
        <Toggle
          checked={groupDisplay}
          onChange={onToggle}
          icons={false} />
      </div>
      {
        groupDisplay &&
          <button className="open-all" onClick={toggleExpandAllSessions}>Open All Sessions</button>
      }
      <span className="search-box">
        <input type="text" name="filter" />
        <span className="glyphicon glyphicon-search" />
      </span>
    </nav>
  );
}

CollectionManagement.propTypes = {
  groupDisplay: PropTypes.bool,
  onToggle: PropTypes.func,
  toggleExpandAllSessions: PropTypes.func
};

export default CollectionManagement;
