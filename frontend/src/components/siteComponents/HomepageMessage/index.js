import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import TempUserTimer from 'components/TempUserTimer';


function HomepageMessage(props) {
  const { auth, showModal } = props;
  const user = auth.get('user');
  const username = user.get('username');
  const showModalCB = () => showModal(true);
  const recCount = user.get('num_recordings');

  return (
    <div className="row wr-hp-message">
      <div className="col-md-6 col-md-offset-3">
        <div className="panel panel-info">
          <div className="panel-heading">
            You have a <b><Link to={`/${username}/temp/index`}>Temporary Collection</Link></b> with {recCount} recording{recCount === 1 ? '' : 's'}, expiring in <b><TempUserTimer ttl={user.get('ttl')} accessed={auth.get('accessed')} /></b>
          </div>
          <div className="panel-body">
            <div className="top-buffer-md">
              <ul>
                <li>
                  <Link to="/_register"><strong>Sign Up</strong></Link> or <button className="button-link" onClick={showModalCB} type="button">Login</button> to keep your collection and give it a permanent address.
                </li>
                <li>
                  Continue capturing by entering another URL below and clicking <b>Start</b>
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
  showModal: PropTypes.func
};

export default HomepageMessage;
