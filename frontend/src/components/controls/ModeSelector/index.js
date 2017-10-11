import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import config from 'config';

import { remoteBrowserMod } from 'helpers/utils';

import OutsideClick from 'components/OutsideClick';
import { PatchIcon, SnapshotIcon } from 'components/icons';

import './style.scss';

class ModeSelector extends PureComponent {

  static contextTypes = {
    currMode: PropTypes.string,
    router: PropTypes.object
  };

  static propTypes = {
    params: PropTypes.object,
    remoteBrowserSelected: PropTypes.object,
    ts: PropTypes.string,
    url: PropTypes.string
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
    const { params: { coll, user }, ts, url } = this.props;

    this.context.router.push(`/${user}/${coll}/${ts}/${url}`);
  }

  onPatch = () => {
    if (this.context.currMode === 'record') return;

    const { params: { coll }, remoteBrowserSelected, ts, url } = this.props;

    window.location = `/_new/${coll}/Patch/patch/${remoteBrowserMod(remoteBrowserSelected, ts, '/')}/${url}`;
  }

  onRecord = () => {
    if (this.context.currMode === 'record') return;

    const { params: { coll, rec }, remoteBrowserSelected, ts, url } = this.props;
    const recording = rec && !rec.startswith('patch') ? rec : encodeURIComponent(config.defaultRecordingTitle);

    window.location = `/_new/${coll}/${recording}/record/${remoteBrowserMod(remoteBrowserSelected, ts, '/')}/${url}`;
  }

  onStaticCopy = () => {

  }

  close = () => {
    if(this.state.open)
      this.setState({ open: false });
  }

  toggle = () => {
    this.setState({ open: !this.state.open });
  }

  render() {
    const { currMode } = this.context;
    const { open } = this.state;
    let modeMessage;
    let modeMarkup;

    const isReplay = currMode.indexOf('replay') !== -1;
    const isRecord = currMode === 'record';
    const isExtract = currMode.indexOf('extract') !== -1;
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
      case 'extract':
      case 'extract_only':
        modeMessage = 'Extracting';
        modeMarkup = <span className="btn-content"><span className="glyphicon glyphicon-dot-sm glyphicon-recording-status Blink" aria-hidden="true" /> <span className="hidden-xs">{ modeMessage }</span></span>;
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
            <button onClick={this.toggle} type="button" className="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
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

                <ul className={classNames('row wr-mode', { active: isPatch, disabled: isRecord })} onClick={this.onPatch} role="button" title={isRecord ? 'Only available from replay after finishing a recording' : 'Record elements that are not yet in the collection'}>
                  <li className="col-xs-3">
                    <PatchIcon />
                  </li>
                  <li className="col-xs-9">
                    <h5>{ isPatch ? 'Currently Patching' : 'Patch this URL' }</h5>
                  </li>
                </ul>

                <ul className={classNames('row wr-mode', { active: isRecord })} onClick={this.onRecord} role="button" title="Start a new recording session at the current URL">
                  <li className="col-xs-3">
                    <span className="glyphicon glyphicon-dot-sm glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                  </li>
                  <li className="col-xs-9">
                    <h5>{ isRecord ? 'Currently Recording' : 'Record this URL again' }</h5>
                  </li>
                </ul>

                {
                  isExtract &&
                    <ul className={classNames('row wr-mode', { active: isExtract })} title="Start a new extraction at the current URL">
                      <li className="col-xs-3">
                        <span className="glyphicon glyphicon-save glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                      </li>
                      <li className="col-xs-9">
                        <h5>Currently Extracting</h5>
                      </li>
                    </ul>
                }

                <div className="divider" role="separator" />

                <ul className="row wr-mode" onClick={this.onStaticCopy} role="button" title="A special recording that contains an exact, static copy of the document as currently displayed. Scripting is removed, so interaction with the copy is limited">
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
