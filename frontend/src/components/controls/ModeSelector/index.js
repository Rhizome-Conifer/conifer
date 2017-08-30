import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import config from 'config';

import { remoteBrowserMod } from 'helpers/utils';

import OutsideClick from 'components/OutsideClick';
import { PatchIcon, SnapshotIcon } from 'components/Icons';

import './style.scss';

class ModeSelector extends Component {

  static contextTypes = {
    currMode: PropTypes.string,
    router: PropTypes.object
  };

  static propTypes = {
    params: PropTypes.object,
    remoteBrowserSelected: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = { open: false };
  }

  onStop = (evt) => {
    evt.preventDefault();
    const { params: { coll, rec, user } } = this.props;

    if (this.context.currMode === 'replay') {
      this.context.router.push(`/${user}/${coll}`);
    } else {
      this.context.router.push(`/${user}/${coll}/${rec}`);
    }
  }

  onReplay = () => {
    const { params: { coll, user, splat } } = this.props;
    const ts = window.wbinfo.timestamp;

    this.context.router.push(`/${user}/${coll}/${ts}/${splat}`);
  }

  onPatch = () => {
    if (this.context.currMode === 'record') return;

    const { params: { coll, splat }, remoteBrowserSelected } = this.props;
    const ts = window.wbinfo.timestamp;

    window.location = `/_new/${coll}/Patch/patch/${remoteBrowserMod(remoteBrowserSelected, ts, '/')}/${splat}`;
  }

  onRecord = () => {
    if (this.context.currMode === 'record') return;

    const { params: { coll, rec, splat, ts }, remoteBrowserSelected } = this.props;
    const timestamp = ts || window.wbinfo.timestamp;
    const recording = rec && !rec.startswith('patch') ? rec : encodeURIComponent(config.defaultRecordingTitle);

    window.location = `/_new/${coll}/${recording}/record/${remoteBrowserMod(remoteBrowserSelected, timestamp, '/')}/${splat}`;
  }

  onStaticCopy = () => {

  }

  close = () => {
    if(this.state.open)
      this.setState({ open: false });
  }

  toggleOpen = () => {
    this.setState({ open: !this.state.open });
  }

  render() {
    const { currMode } = this.context;
    const { open } = this.state;
    let modeMessage;
    let modeMarkup;

    const isReplay = currMode.indexOf('replay') !== -1;
    const isRecord = currMode === 'record';
    const isExtract = currMode === 'extract';
    const isPatch = currMode === 'patch';

    switch(currMode) {
      case 'record':
        modeMessage = 'Recording';
        modeMarkup = <span className="btn-content"><span className="glyphicon glyphicon-dot-sm glyphicon-recording-status Blink" aria-hidden="true" /> <span className="hidden-xs">{ modeMessage }</span></span>;
        break;
      case 'replay':
      case 'replay-coll':
        modeMessage = 'Replaying';
        modeMarkup = <span className="btn-content"><span className="glyphicon glyphicon-play-circle" aria-hidden="true" /> <span className="hidden-xs">{ modeMessage }</span></span>;
        break;
      case 'patch':
        modeMessage = 'Patching';
        modeMarkup = <span className="btn-content"><PatchIcon /> <span className="hidden-xs">{ modeMessage }</span></span>;
        break;
      default:
        break;
    }

    const modeSelectorClasses = classNames('wr-mode-selector', 'btn-group', { open });

    return (
      <OutsideClick handleClick={this.close}>
        <div className="mode-selector">
          <div className={modeSelectorClasses}>
            <button type="button" onClick={this.onStop} className="btn btn-default wr-mode-message content-action" role="button" aria-label={`Finish ${modeMessage} session`}>
              <span className="btn-content"><span className="glyphicon glyphicon-stop" /> <span className="hidden-xs">Stop</span></span>
              { modeMarkup }
            </button>
            <button onClick={this.toggleOpen} type="button" className="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
              <span className="glyphicon glyphicon-triangle-bottom" />
            </button>

            <div className="dropdown-menu">
              <div className="wr-modes">

                <ul className={classNames('row wr-mode', { active: isReplay })} onClick={this.onReplay} role="button" title="Access an archived version of this URL">
                  <li className="col-xs-3">
                    <span className="glyphicon glyphicon-play-circle wr-mode-icon" aria-hidden="true" />
                  </li>
                  <li className="col-xs-9">
                    <h5>{ isReplay ? 'Currently Replaying' : 'Replay this URL' }</h5>
                  </li>
                </ul>

                <ul className={classNames('row wr-mode', { active: isPatch, disabled: isRecord })} onClick={this.onPatch} title={isRecord ? 'Only available from replay after finishing a recording' : 'Record elements that are not yet in the collection'}>
                  <li className="col-xs-3">
                    <PatchIcon />
                  </li>
                  <li className="col-xs-9">
                    <h5>{ isPatch ? 'Currently Patching' : 'Patch this URL' }</h5>
                  </li>
                </ul>

                <ul className={classNames('row wr-mode', { active: isRecord })} onClick={this.onRecord} title="Start a new recording session at the current URL">
                  <li className="col-xs-3">
                    <span className="glyphicon glyphicon-dot-sm glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                  </li>
                  <li className="col-xs-9">
                    <h5>{ isRecord ? 'Currently Recording' : 'Record this URL again' }</h5>
                  </li>
                </ul>

                {
                  isExtract &&
                    <ul className="row wr-mode" title="Start a new extraction at the current URL">
                      <li className="col-xs-3">
                        <span className="glyphicon glyphicon-save glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                      </li>
                      <li className="col-xs-9">
                        <h5>Currently Extracting</h5>
                      </li>
                    </ul>
                }

                <div className="divider" role="separator" />

                <ul className="row wr-mode" onClikc={this.onStaticCopy} title="A special recording that contains an exact, static copy of the document as currently displayed. Scripting is removed, so interaction with the copy is limited">
                  <li className="col-xs-3">
                    <SnapshotIcon />
                  </li>
                  <li className="col-xs-9">
                    <h5>Static Copy</h5>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </OutsideClick>
    );
  }
}

export default ModeSelector;
