import React from 'react';
import { Link } from 'react-router-dom';

import './style.scss';

const logo = require('./logo.png');


function HomepageAnnouncement() {
  return (
    <div className="row">
      <div id="news-alert" className="alert alert-info col-xs-8 col-xs-push-2 col-sm-6 col-sm-push-3" role="alert">
        <button type="button" className="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <div className="wr-alert-logo">
          <img src={logo} alt="Webrecorder logo" />
        </div>
        <div className="wr-alert-info">
          <h5><b>Please Note:</b> this is an experimental demo instance for the EAW workshop. You should download any data that you care about as a WARC file</h5>
        </div>
      </div>
    </div>
  );
}

export default HomepageAnnouncement;
