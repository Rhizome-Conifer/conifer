import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, InputGroup } from 'react-bootstrap';

import { capitalize } from 'helpers/utils';

import TimeFormat from 'components/TimeFormat';

import './style.scss';


class PatchWidgetUI extends PureComponent {
  static propTypes = {
    toRecording: PropTypes.string,
    timestamp: PropTypes.string,
    stats: PropTypes.object
  };

  render() {
    const { toRecording, stats, timestamp } = this.props;

    const archiveName = (
      stats && stats.length ?
        `Patched from ${stats.length} source${stats.length === 1 ? '' : 's'}` :
        'Patching'
    );

    return (
      <Dropdown alignRight as={InputGroup.Append} className="patch-selector sources-widget d-none d-md-flex">
        <Dropdown.Toggle variant="warning">
          <ul>
            <li className="ts main-replay-date">{timestamp ? <TimeFormat dt={timestamp} gmt /> : 'Most Recent'}</li>
            <li className="mnt-label">
              {archiveName}
              {
                stats && stats.length &&
                  <span className="caret" />
              }
            </li>
          </ul>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <div className="ra-mode-row">
            <span className="ra-mode-badge patch">patching</span> to <div className="ra-recording">{ capitalize(toRecording.replace('-', ' ')) }</div>
          </div>
          {
            stats &&
              <div className="ra-resources">
                <span className="ra-replay-info-label">Patched resources from:</span>
                <ul>
                  {
                    stats.map(obj => <li key={obj.id}>{`${obj.name} (${obj.stat})`}</li>)
                  }
                </ul>
              </div>
          }
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default PatchWidgetUI;
