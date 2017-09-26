import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import OutsideClick from 'components/OutsideClick';
import TimeFormat from 'components/TimeFormat';

import './style.scss';


class ExtractWidgetUI extends Component {
  static propTypes = {
    active: PropTypes.bool,
    archiveSources: PropTypes.object,
    extractable: PropTypes.object,
    toCollection: PropTypes.string,
    timestamp: PropTypes.number,
    url: PropTypes.string,
    toggleAllSources: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      open: false
    };
  }

  toggle = () => {
    this.setState({ open: !this.state.open });
  }

  close = () => {
    if(this.state.open)
      this.setState({ open: false });
  }

  toggleSources = (evt) => {
    const { toggleAllSources, extractable } = this.props;
    toggleAllSources(!extractable.get('allSources'));
  }

  render() {
    const { active, archiveSources, extractable, toCollection } = this.props;
    const { open } = this.state;
    const allSources = extractable.get('allSources');

    const requestedTimestamp = extractable.get('timestamp');
    const timestamp = this.props.timestamp ? this.props.timestamp : requestedTimestamp;

    const classes = classNames('btn-group', { open });
    const archiveToggleClasses = classNames('archive-toggle', { on: allSources });
    const archiveName = (
      `${extractable.getIn(['archive', 'name'])}
       ${extractable.get('targetColl') ? `${extractable.get('targetColl')}` : ''}`
    );

    return (
      <OutsideClick classes={classes} handleClick={this.close}>
        <button className="btn btn-primary sources-widget dropdown-toggle" onClick={this.toggle} type="button" id="timePicker" aria-haspopup="true" aria-expanded="true">
          <ul>
            <li className="ts main-replay-date">{timestamp ? <TimeFormat dt={timestamp} gmt /> : 'Most Recent'}</li>
            <li className="mnt-label">
              {archiveName}
              {archiveSources.size ? ` + ${archiveSources.size}` : ''}
              <span className="caret" /></li>
          </ul>
        </button>
        <div className="dropdown-menu sources-dropdown" aria-labelledby="timePicker">
          <div className="ra-mode-row">
            <span className="ra-mode-badge extract">extracting</span> to <div className="ra-collection">{ toCollection || 'Choose a collection' }</div>
          </div>
          <div className="ra-info">
            <div>
              <span>URL</span>
              <span>FROM</span>
              {
                timestamp !== requestedTimestamp &&
                  <span>REQUESTED</span>
              }
              <span>TIMESTAMP</span>
            </div>
            <div>
              <span className="ra-source">
                {extractable.get('targetUrl')}
              </span>
              <span className="ra-source-name">
                <a href={extractable.getIn(['archive', 'about'])} target="_blank">
                  {archiveName}
                  <span className="glyphicon glyphicon-new-window" />
                </a>
              </span>
              {
                timestamp !== requestedTimestamp &&
                  <TimeFormat epoch={requestedTimestamp} gmt />
              }
              <span className="ra-ts">
                <TimeFormat dt={timestamp} gmt />
              </span>
            </div>
          </div>

          {
            active ?
              <div className="ra-resources">
                <span className="ra-replay-info-label">Resources loaded from:</span>
                <ul>
                  <li>No resources loaded yet</li>
                </ul>
              </div> :
              <div className={archiveToggleClasses}>
                <div className="checkbox-block" onClick={this.toggleSources}>
                  <input
                    key="sourcesCheckbox"
                    id="all-archives"
                    name="all_archives"
                    type="checkbox"
                    onChange={this.toggleSources}
                    checked={allSources} />
                </div>
                <label htmlFor="all-archives">Automatically attempt recovery of missing resources using public archives and the live web.</label>
              </div>
          }
        </div>
      </OutsideClick>
    );
  }
}

export default ExtractWidgetUI;
