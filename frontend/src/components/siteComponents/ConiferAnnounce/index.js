import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';

import { XIcon } from 'components/icons';

import './style.scss';


const ConiferAnnounce = React.memo(({ dismiss, condensed }) => {
  return (
    <div className={classNames('conifer-announce', { condensed })}>
      {
        condensed ?
          <div className="announcement">
            <div><b>Twilight announcement</b>: Creating and modifying collections was disabled before Conifer's discontinuation in June 2026. Please read the <a href="https://blog.conifer.rhizome.org/" target="_blank">Conifer blog</a> to learn more.</div>
            <Button variant="link" className="dismiss" aria-label="Dismiss Conifer Announcement" onClick={dismiss}><XIcon /></Button>
          </div> :
          <div className="announcement">
            <div>
              <h2>Twilight announcement: Creating and modifying collections was disabled before Conifer's discontinuation in June 2026.</h2>
              <p>
                Please read the the <a href="https://blog.conifer.rhizome.org/" target="_blank">Conifer blog</a> to learn more.
              </p>
            </div>
            <Button variant="link" className="dismiss" aria-label="Dismiss Conifer Announcement" onClick={dismiss}><XIcon /></Button>
          </div>
      }
    </div>
  );
});

ConiferAnnounce.propTypes = {
  dismiss: PropTypes.func
};

export default ConiferAnnounce;
