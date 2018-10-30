import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { basename } from 'path';
import { Link } from 'react-router-dom';

import { openFile } from 'helpers/playerUtils';

import { PlayerArrowLeftIcon, PlayerArrowRightIcon, PlayerCloseIcon, RefreshIcon, HelpIcon } from 'components/icons';

import './style.scss';


class PlayerNavUI extends Component {

  static propTypes = {
    collectionLoaded: PropTypes.bool,
    canGoBackward: PropTypes.bool,
    canGoForward: PropTypes.bool,
    history: PropTypes.object,
    route: PropTypes.object,
    source: PropTypes.string
  };

  triggerBack = () => {
    const { canGoBackward, history, route } = this.props;
    const isReplay = route && route.name.indexOf('replay') !== -1;

    if (isReplay && canGoBackward) {
      window.dispatchEvent(new Event('wr-go-back'));
    } else if (history.canGo(-1)) {
      history.goBack();
    }
  }

  triggerForward = () => {
    const { canGoForward, history, route } = this.props;
    const isReplay = route && route.name.indexOf('replay') !== -1;

    if (isReplay && canGoForward) {
      window.dispatchEvent(new Event('wr-go-forward'));
    } else if (history.canGo(1)) {
      history.goForward();
    }
  }

  triggerRefresh = () => {
    window.dispatchEvent(new Event('wr-refresh'));
  }

  sendOpenFile = () => {
    openFile(this.props.history);
  }

  goToHelp = () => {
    this.props.history.push('/help');
  }

  render() {
    const { canGoForward, collectionLoaded, history, route, source } = this.props;

    const indexUrl = collectionLoaded ? '/local/collection' : '/';
    const isLanding = route && route.name === 'landing';
    const isReplay = route && route.name.indexOf('replay') !== -1;
    const isHelp = route && route.name === 'help';

    const canGoBack = history.canGo(-1);

    const backClass = classNames('arrow', {
      inactive: !canGoBack
    });
    const fwdClass = classNames('arrow', {
      inactive: isReplay ? !canGoForward : !history.canGo(1)
    });
    const refreshClass = classNames('arrow', {
      inactive: !isReplay
    });

    const format = source && (source.startsWith('dat://') ? `${source.substr(0, 30)}...` : basename(source));

    return (
      <React.Fragment>
        {
          isLanding ?
            <div className="landing-header">
              <button id="help" onClick={this.goToHelp} className="button" title="Help">
                <HelpIcon />
                <span>About</span>
              </button>
            </div> :
            <nav className={`topBar ${route && route.name}`}>
              <div className="logos">
                <Link to={indexUrl} className="logotype">
                  <img className="wrLogoImg" src={require('shared/images/logo.svg')} alt="webrecorder logo" /><br />
                </Link>

                <div className="browser-nav">
                  <button id="back" onClick={this.triggerBack} disabled={!canGoBack} className={backClass} title="Click to go back" aria-label="navigate back">
                    <PlayerArrowLeftIcon />
                  </button>
                  <button id="forward" onClick={this.triggerForward} disabled={isReplay ? !canGoForward : !history.canGo(1)} className={fwdClass} title="Click to go forward" aria-label="navigate forward">
                    <PlayerArrowRightIcon />
                  </button>
                  <button id="refresh" onClick={this.triggerRefresh} disabled={!isReplay} className={refreshClass} title="Refresh replay window">
                    <RefreshIcon />
                  </button>
                </div>
                {
                  source &&
                    <div className="source" title={source}>
                      {format}
                    </div>
                }
              </div>

              <div className="player-functions">
                <button onClick={this.sendOpenFile} title="Open file">
                  Open...
                </button>

                {
                  isHelp ?
                    <button id="help" onClick={this.props.history.goBack} title="Help">
                      <PlayerCloseIcon />
                    </button> :
                    <button id="help" onClick={this.goToHelp} className="button grow" title="Help">
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
