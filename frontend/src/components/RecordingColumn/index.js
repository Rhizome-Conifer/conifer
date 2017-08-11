import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';

import RecordingCard from 'components/RecordingCard';

import './style.scss';

class RecordingColumn extends Component {
  static propTypes = {
    recordings: PropTypes.object
  };

  static defaultProps = fromJS({
    recordings: {}
  })

  render() {
    const { recordings } = this.props;

    return (
      <div className="recording-selector">
        <div id="all-card" className="card-top">
          <div>
            <b><span id="num-recs" />&nbsp;Recordings</b>&nbsp; &nbsp;<span id="sel-info" />
          </div>
          <div className="recording-stats text-left top-buffer-md right-buffer-sm">
            <span id="sel-bookmarks" className="bookmark-count">0</span> bookmarks&nbsp; &nbsp;
            <span className="current-size text-right">0kb</span>
          </div>
        </div>
        <div className="rec-filter">
          <a id="clear-all-widget" className="clear-all-btn disabled">no filters</a>
          <a className="toggle-details-btn">hide details</a>
        </div>
        <div className="recording-bin">
          {
            recordings.map(rec => <RecordingCard rec={rec} key={rec.get('id')} />)
          }
        </div>
      </div>
    );
  }
}

export default RecordingColumn;
