import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { XIcon } from 'components/icons';

import './style.scss';


const ConiferAnnounce = React.memo(({ dismiss }) => {
  return (
    <div className="conifer-announce">
      <div className="announcement">
        <div>
          <h2>Twilight announcement: Conifer is going to be discontinued in June 2026.</h2>
          <p>
            Read the announcement post to <a href="https://blog.conifer.rhizome.org/2025/12/12/twilight-announcement.html" target="_blank">learn more</a>.
          </p>
        </div>
        <Button variant="link" className="dismiss" aria-label="Dismiss Conifer Announcement" onClick={dismiss}><XIcon /></Button>
      </div>
    </div>
  );
});

ConiferAnnounce.propTypes = {
  dismiss: PropTypes.func
};

export default ConiferAnnounce;
