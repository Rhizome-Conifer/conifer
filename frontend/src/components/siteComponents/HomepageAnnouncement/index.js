import React from 'react';

import { homepageAnnouncement } from 'config';

import './style.scss';

const logo = require('shared/images/logo.svg');


function HomepageAnnouncement() {
  return (
    <div className="row">
      <div id="news-alert" className="alert alert-info col-xs-8 col-xs-push-2 col-sm-6 col-sm-push-3" role="alert">
        <button type="button" className="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <div className="wr-alert-logo">
          <img src={logo} alt="Webrecorder logo" />
        </div>
        <div className="wr-alert-info" dangerouslySetInnerHTML={{ __html: homepageAnnouncement }} />
      </div>
    </div>
  );
}

export default HomepageAnnouncement;
