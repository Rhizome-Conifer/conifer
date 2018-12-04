import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import OutsideClick from 'components/OutsideClick';
import { InfoIcon, XIcon } from 'components/icons';

import './style.scss';


class InfoWidgetUI extends Component {
  static propTypes = {
    collection: PropTypes.object,
    stats: PropTypes.array
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

  close = (evt) => {
    evt.preventDefault();

    if (!this.state.open) {
      return;
    }

    this.setState({ open: false });
  }

  render() {
    const { collection, stats } = this.props;
    const { open } = this.state;

    const widgetClass = classNames('wr-info-widget', {
      open,
      visible: (stats && stats.length > 1) || (stats && stats.length === 1 && stats[0].id !== 'replay')
    });

    return (
      <OutsideClick disabled={!open} classes={widgetClass} handleClick={this.close}>
        <button className="dropdown-toggle" onClick={this.toggle} type="button" id="replayInfo" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
          <InfoIcon />
        </button>
        <div className="dropdown-menu arrow_box">
          <button className="borderless remove-circle" onClick={this.close} type="button">
            <XIcon />
          </button>
          <span className="ra-replay-info-label">Now Viewing Collection</span>
          <h5>{ collection.get('title')}</h5>
          <div className="ra-recording-block">
            <div className="ra-resources">
              <span className="ra-replay-info-label">Resources recorded from:</span>
              <ul>
                {
                  stats ?
                    stats.map(obj => <li key={obj.id}>{`${obj.name} (${obj.stat})`}</li>) :
                    <li>No resources loaded yet</li>
                }
              </ul>
            </div>
          </div>
        </div>
      </OutsideClick>
    );
  }
}

export default InfoWidgetUI;
