import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { basename } from 'path';
import { Link } from 'react-router-dom';

import { openFile } from 'helpers/playerUtils';

import { PlayerCloseIcon, HelpIcon } from 'components/icons';

import './style.scss';


class PlayerNavUI extends Component {

  static propTypes = {
    collectionLoaded: PropTypes.bool,
    history: PropTypes.object,
    route: PropTypes.object,
    source: PropTypes.string
  };

  sendOpenFile = () => {
    openFile(this.props.history);
  }

  goToHelp = () => {
    this.props.history.push('/help');
  }

  render() {
    const { collectionLoaded, history, route, source } = this.props;

    const indexUrl = collectionLoaded ? '/local/collection' : '/';
    const isLanding = route && route.name === 'landing';
    const isReplay = route && route.name.indexOf('replay') !== -1;
    const isHelp = route && route.name === 'help';

    const format = source && (source.startsWith('dat://') ? `${source.substr(0, 30)}...` : basename(source));

    return (
      <React.Fragment>
        {
          isLanding ?
            <div className="landing-header">
              <button id="help" onClick={this.goToHelp} className="button" title="Help" type="button">
                <HelpIcon />
                <span>About</span>
              </button>
            </div> :
            <nav className={`topBar ${route && route.name}`}>
              <div className="logos">
                <Link to={indexUrl} className="logotype">
                  <img className="wrLogoImg" src={require('shared/images/logo.svg')} alt="webrecorder logo" /><br />
                </Link>

                {
                  source &&
                    <div className="source" title={source}>
                      {format}
                    </div>
                }
              </div>

              <div className="player-functions">
                <button onClick={this.sendOpenFile} title="Open file" type="button">
                  Open...
                </button>

                {
                  isHelp ?
                    <button id="help" onClick={this.props.history.goBack} title="Help" type="button">
                      <PlayerCloseIcon />
                    </button> :
                    <button id="help" onClick={this.goToHelp} className="button grow" title="Help" type="button">
                      Help
                    </button>
                }
              </div>
            </nav>
        }
      </React.Fragment>
    );
  }
}

export default PlayerNavUI;
