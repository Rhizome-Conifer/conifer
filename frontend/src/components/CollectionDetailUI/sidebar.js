import React from 'react';
import PropTypes from 'prop-types';


export function RecordingSession(props) {
  const { rec } = props;

  const onSelect = () => {
    props.select(rec);
  };

  if (!rec.get('pages').size) {
    return <button className="recording-session" disabled>{rec.get('title')}</button>
  }

  return (
    <button className="recording-session" onClick={onSelect}>{rec.get('title')}</button>
  );
}

RecordingSession.propTypes = {
  rec: PropTypes.object,
  select: PropTypes.func
};
