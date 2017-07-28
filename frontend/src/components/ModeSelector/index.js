import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { PatchIcon, SnapshotIcon } from 'components/Icons';

import './style.scss';

function ModeSelector(props, context) {
  const { currMode } = context;
  let modeMessage;
  let modeMarkup;

  const isReplay = currMode.indexOf('replay') !== -1;

  switch(currMode) {
    case 'record':
      modeMessage = 'Recording';
      modeMarkup = <span className="btn-content"><span className="glyphicon glyphicon-dot-sm glyphicon-recording-status Blink" aria-hidden="true" /> <span className="hidden-xs">{ modeMessage }}</span></span>;
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

  return (
    <div className="mode-selector">
      <div className="wr-mode-selector btn-group">
        <button type="button" className="btn btn-default wr-mode-message content-action" role="button" aria-label={`Finish ${modeMessage} session`}>
          <span className="btn-content"><span className="glyphicon glyphicon-stop" /> <span className="hidden-xs">Stop</span></span>
          { modeMarkup }
        </button>
        <button type="button" className="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          <span className="glyphicon glyphicon-triangle-bottom" />
        </button>

        <div className="dropdown-menu">
          <div className="wr-modes">

            <ul className={classNames('row wr-mode', { active: isReplay })} data-mode="replay" title="Access an archived version of this URL">
              <li className="col-xs-3">
                <span className="glyphicon glyphicon-play-circle wr-mode-icon" aria-hidden="true" />
              </li>
              <li className="col-xs-9">
                <h5>{ isReplay ? 'Currently Replaying' : 'Replay this URL' }</h5>
              </li>
            </ul>

            <ul className={classNames('row wr-mode', { active: currMode === 'patch', disabled: currMode === 'record' })} data-mode="patch" title={currMode === 'record' ? 'Only available from replay after finishing a recording' : 'Record elements that are not yet in the collection'}>
              <li className="col-xs-3">
                <PatchIcon />
              </li>
              <li className="col-xs-9">
                <h5>{ currMode === 'patch' ? 'Currently Patching' : 'Patch this URL' }</h5>
              </li>
            </ul>

            <ul className={classNames('row wr-mode', { active: currMode === 'record' })} data-mode="record" title="Start a new recording session at the current URL">
              <li className="col-xs-3">
                <span className="glyphicon glyphicon-dot-sm glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
              </li>
              <li className="col-xs-9">
                <h5>{ currMode === 'record' ? 'Currently Recording' : 'Record this URL again' }</h5>
              </li>
            </ul>

            {
              currMode === 'extract' &&
                <ul className="row wr-mode" data-mode="extract" title="Start a new extraction at the current URL">
                  <li className="col-xs-3">
                    <span className="glyphicon glyphicon-save glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                  </li>
                  <li className="col-xs-9">
                    <h5>Currently Extracting</h5>
                  </li>
                </ul>
            }

            <div className="divider" role="separator" />

            <ul className="row wr-mode" data-mode="snapshot" title="A special recording that contains an exact, static copy of the document as currently displayed. Scripting is removed, so interaction with the copy is limited">
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
  );
}

ModeSelector.contextTypes = {
  currMode: PropTypes.string
};

export default ModeSelector;
