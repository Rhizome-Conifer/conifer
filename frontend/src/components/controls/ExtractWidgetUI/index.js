import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Dropdown, InputGroup } from 'react-bootstrap';

import TimeFormat from 'components/TimeFormat';
import { LinkIcon } from 'components/icons';

import './style.scss';


class ExtractWidgetUI extends PureComponent {
  static propTypes = {
    active: PropTypes.bool,
    extractable: PropTypes.object,
    stats: PropTypes.array,
    toCollection: PropTypes.string,
    timestamp: PropTypes.number,
    url: PropTypes.string,
    toggleAllSources: PropTypes.func
  };

  static defaultProps = {
    active: false
  };

  toggleSources = (evt) => {
    const { toggleAllSources, extractable } = this.props;
    toggleAllSources(!extractable.get('allSources'));
  }

  render() {
    const { active, extractable, stats, toCollection } = this.props;
    const allSources = extractable.get('allSources');

    const requestedTimestamp = extractable.get('timestamp');
    const timestamp = this.props.timestamp ? this.props.timestamp : requestedTimestamp;

    const archiveToggleClasses = classNames('archive-toggle', { on: allSources });
    const archiveName = (
      `${extractable.getIn(['archive', 'name'])}
       ${extractable.get('targetColl') ? `${extractable.get('targetColl')}` : ''}`
    );

    return (
      <Dropdown alignRight as={InputGroup.Append} className="extract-selector sources-widget d-none d-md-flex">
        <Dropdown.Toggle>
          <ul>
            <li className="ts main-replay-date">{timestamp ? <TimeFormat dt={timestamp} gmt /> : 'Most Recent'}</li>
            <li className="mnt-label">
              {archiveName}
              { (stats && stats.length > 1) || (stats && stats.length === 1 && stats[0].id !== extractable.get('id')) ? ` + ${stats.length} ` : ''}
              <span className="caret" />
            </li>
          </ul>
        </Dropdown.Toggle>
        <Dropdown.Menu>
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
                  <LinkIcon />
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
                  {
                    stats && stats.length ?
                      stats.map(obj => <li key={obj.id}>{`${obj.name} (${obj.stat})`}</li>) :
                      <li>No resources loaded yet</li>
                  }
                </ul>
              </div> :
              <div className={archiveToggleClasses}>
                <div className="checkbox-block" role="button" onClick={this.toggleSources} tabIndex={0}>
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
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default ExtractWidgetUI;
