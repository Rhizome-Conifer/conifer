import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';

function HomepageMessage(props) {
  const { auth, info } = props;

  return (
    <div className="row">
      <div className="col-md-6 col-md-offset-3">
        <div className="panel panel-info">
          <div className="panel-heading">
            You are logged-in as <b><Link to={auth.user.username}>{ auth.user.username }</Link></b>
          </div>
          <div className="panel-body">
            <div className="top-buffer-md">
              <ul>
                <li>
                  Browse: There are <Link to={auth.user.username}><b>{ info.data.collections.length } Collections</b></Link> in your archive.
                </li>
                <li>
                  Record: Enter a url, choose a collection (or create a new one), then click <b>Record</b> to begin.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

HomepageMessage.propTypes = {
  auth: PropTypes.object,
  info: PropTypes.object,
};

export default HomepageMessage;
