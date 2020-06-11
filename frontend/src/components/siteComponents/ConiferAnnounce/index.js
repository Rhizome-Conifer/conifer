import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { XIcon } from 'components/icons';

import './style.scss';


const ConiferAnnounce = React.memo(({ dismiss }) => {
  return (
    <div className="conifer-announce">
      <div className="logos" />
      <div className="announcement">
        <div>
          <h2>New Name, Same Service! <span aria-label="evergreen tree" role="img">🌲</span><span aria-label="sparkles" role="img">✨</span></h2>
          <p>
            <strong>The Webrecorder.io web archiving service is now&nbsp;Conifer.</strong>
            <a href="https://blog.conifer.rhizome.org/2020/06/11/webrecorder-conifer.html" target="_blank">Full Announcement</a>
          </p>
          <p>
            <strong>The Webrecorder software project is now an independent entity.</strong>
            <a href="https://webrecorder.net/" target="_blank">Learn more</a>
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
