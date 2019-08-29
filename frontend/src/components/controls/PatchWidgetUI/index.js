import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { capitalize } from 'helpers/utils';

import OutsideClick from 'components/OutsideClick';
import TimeFormat from 'components/TimeFormat';

import './style.scss';


class PatchWidgetUI extends Component {
  static propTypes = {
    toRecording: PropTypes.string,
    timestamp: PropTypes.string,
    stats: PropTypes.object
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
    if (this.state.open) {
      this.setState({ open: false });
    }
  }

  render() {
    const { toRecording, stats, timestamp } = this.props;
    const { open } = this.state;

    const classes = classNames('btn-group', { open });
    const archiveName = (
      stats && stats.length ?
        `Patched from ${stats.length} source${stats.length === 1 ? '' : 's'}` :
        'Patching'
    );

    return (
      <OutsideClick classes={classes} handleClick={this.close}>
        <button className="btn btn-warning sources-widget dropdown-toggle" onClick={this.toggle} type="button" id="timePicker" aria-haspopup="true" aria-expanded="true">
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
        </button>
        <div className="dropdown-menu" aria-labelledby="timePicker">
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
        </div>
      </OutsideClick>
    );
  }
}

export default PatchWidgetUI;
