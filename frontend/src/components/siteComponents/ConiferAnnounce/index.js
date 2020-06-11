import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'react-bootstrap';

import { XIcon } from 'components/icons';

import './style.scss';


const ConiferAnnounce = React.memo(({ dismiss }) => {
  return (
    <div className="conifer-announce">
      <div className="banner">
        <div className="wrapper">
          <h3>New Name, Same Great Service!</h3>
          <button className="dismiss" aria-label="Dismiss Conifer Announcement" onClick={dismiss} type="button"><XIcon /></button>
        </div>
      </div>
      <Row className="info">
        <Col>
          The Webrecorder.io web archiving service is now&nbsp;Conifer.&nbsp;<span aria-label="branch emoji" role="img">🌿</span><br />
          <a href="https://rhizome.org/editorial/2020/jun/10/introducing-conifer/" target="_blank">Full Announcement</a>
        </Col>
        <Col className="signup-link">
          The Webrecorder software project is now an independent entity. <a href="https://webrecorder.net/" target="_blank">Learn more</a>
        </Col>
      </Row>
    </div>
  );
});

ConiferAnnounce.propTypes = {
  dismiss: PropTypes.func
};

export default ConiferAnnounce;
