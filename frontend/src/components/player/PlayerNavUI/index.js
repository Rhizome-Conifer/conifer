import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { basename } from 'path';
import { Link } from 'react-router-dom';

import { openFile } from 'helpers/playerUtils';

import { PlayerCloseIcon, FileOpenIcon, HelpIcon } from 'components/icons';
// import { PlayerURLBar } from 'containers';

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
    if (this.props.canGoBackward) {
      window.dispatchEvent(new Event('wr-go-back'));
    }
  }

  triggerForward = () => {
    if (this.props.canGoForward) {
      window.dispatchEvent(new Event('wr-go-forward'));
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
    const { canGoBackward, canGoForward, collectionLoaded, route, source } = this.props;

    const indexUrl = collectionLoaded ? '/local/collection/index' : '/';
    const isLanding = route && route.name === 'landing';
    const isReplay = route && route.name.indexOf('replay') !== -1;
    const isHelp = route && route.name === 'help';

    const fwdClass = classNames('button arrow', {
      inactive: !canGoForward,
      off: false
    });
    const backClass = classNames('button arrow', {
      inactive: !canGoBackward,
      off: false
    });

    //const format = source && (source.startsWith('dat://') ? `${source.substr(0, 30)}...` : `file:${process.platform === 'win32' ? '\\' : '//'}${basename(source)}`);
    const format = source;
    let archiveType = "Archive";
    if (source) {
      if (source.endsWith(".warc.gz") || source.endsWith(".warc")) {
        archiveType = "WARC";
      } else if (source.endsWith(".arc.gz") || source.endsWith(".arc")) {
        archiveType = "ARC";
      } else if (source.endsWith(".har")) {
        archiveType = "HAR";
      }
    }

    return (
      <nav className={`topBar ${route && route.name}`}>
        <div className="logos">
          <Link to={indexUrl} className="button home-btn">
            <img className="wrLogoImg" src={require('shared/images/webrecorder_logo_solo.png')} alt="webrecorder logo" /><br />
            <img className="wrLogoPlayerTxt" src={require('shared/images/player_text.png')} alt="webrecorder logo" />
          </Link>
          {
            isLanding &&
              <Link to={indexUrl} className="button home-btn">
                <img className="wrLogoImgTxt" src={require('shared/images/webrecorder_player_logo_text.png')} alt="webrecorder logo" />
              </Link>
          }
        </div>

        {
          isReplay &&
            <div className="browser-nav">
              <button id="back" onClick={this.triggerBack} className={backClass} title="Click to go back">
                <object data={require('shared/images/Back_Arrow.svg')} type="image/svg+xml" aria-label="navigate back" />
              </button>
              <button id="forward" onClick={this.triggerForward} className={fwdClass} title="Click to go forward">
                <object id="forwardArrow" data={require('shared/images/Back_Arrow.svg')} type="image/svg+xml" aria-label="navigate forward" />
              </button>
              <button id="refresh" onClick={this.triggerRefresh} className="button arrow" title="Refresh replay window">
                <object data={require('shared/images/Refresh.svg')} type="image/svg+xml" aria-label="refresh" />
              </button>

              {/*<PlayerURLBar />*/}
            </div>
        }

        {
          source &&
            <div className="source-group">
              <div className="input-group">
                <div className="input-group-addon" onClick={this.sendOpenFile} title="Currently loaded WARC, ARC, or HAR archive file. Click to change.">{archiveType}</div>
                <input className="source form-control" onDoubleClick={this.sendOpenFile} readOnly value={format} title="Currently loaded WARC, ARC, HAR archive file. Double-click to change."/>
              </div>
            </div>
        }

        <div className="player-functions">
          <button onClick={this.sendOpenFile} className="button grow" title="Open file">
            <FileOpenIcon />
          </button>

          {
            isHelp ?
              <button id="help" onClick={this.props.history.goBack} className="button grow" title="Help">
                <PlayerCloseIcon />
              </button> :
              <button id="help" onClick={this.goToHelp} className="button grow" title="Help">
                <HelpIcon />
              </button>
          }
        </div>
      </nav>
    );
  }
}

export default PlayerNavUI;
