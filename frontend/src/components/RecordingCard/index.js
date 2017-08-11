import React from 'react';
import PropTypes from 'prop-types';

import EditableString from 'components/EditableString';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';

import './style.scss';

function RecordingCard(props) {
  const { rec } = props;

  return (
    <div className="card">
      <div className="checkbox-column">
        <input type="checkbox" />
      </div>

      <div className="content-column">
        <div className="recording-content">
          <EditableString string={rec.get('title')} icon={false} />
          <div className="recording-details">
            <div className="recording-stats text-left right-buffer-sm">
              <small>
                { rec.get('is_patch') ?
                  <span className="ra-mode-badge patch">PATCH</span> :
                  <span className="bookmark-count">{`${0} bookmarks`}</span>
                }
                <span className="current-size text-right"><SizeFormat bytes={rec.get('size')} /></span>
              </small>
            </div>
            <div className="recording-time-info top-buffer-sm text-left right-buffer-sm">
              <TimeFormat epoch={rec.get('updated_at')} />
            </div>

            <div className="recording-time-info text-left right-buffer-sm">
              { rec.get('duration') }
            </div>

            <div className="recording-fn-row">
              <a className="edit-title" title="Edit recording title" data-editing-id="{{ editing_id }}"><span className="glyphicon glyphicon-pencil" /></a>
              <a href="{{ recording.download_url }}" title="Download recording"><span className="glyphicon glyphicon-cloud-download" /></a>
              {/* if not is_anon() */}
              <a title="Move recording to another collection" data-toggle="modal" data-target="#move-modal" data-move-rec-id="{{ recording.id }}" data-recording-title="{{ recording.title|urlencode }}"><span className="glyphicon glyphicon-export" /></a>
              <div><a title="Delete recording" data-toggle="modal" data-target="#confirm-delete-recording-modal-{{ recording.id }}" ><span className="glyphicon glyphicon-trash" /></a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

RecordingCard.propTypes = {
  rec: PropTypes.object
};

export default RecordingCard;
