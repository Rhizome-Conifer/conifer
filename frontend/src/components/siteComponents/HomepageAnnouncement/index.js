import React from 'react';

import { homepageAnnouncement } from 'config';

import './style.scss';

const logo = require('shared/images/logo.svg');


function HomepageAnnouncement() {
  return (
    <div id="news-alert" className="alert alert-info" role="alert">
      <button type="button" className="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
      <div className="wr-alert-info" dangerouslySetInnerHTML={{ __html: homepageAnnouncement }} />
    </div>
  );
}

export default HomepageAnnouncement;
