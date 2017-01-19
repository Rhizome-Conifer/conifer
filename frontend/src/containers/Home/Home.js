import React, { Component, PropTypes } from 'react';
import { asyncConnect } from 'redux-connect';
import { Link } from 'react-router';

import { isLoaded, load } from 'redux/modules/info';


class Home extends Component {

  static propTypes = {
    auth: PropTypes.object,
    info: PropTypes.object
  }

  render() {
    const { auth, info } = this.props;

    const loaded = auth.loaded && info.loaded;

    return (
      <div>
        <div className="row top-buffer">
          <h1 className="text-center"><strong>Webrecorder</strong></h1>
        </div>
        <div className="row">
          <h4 className="text-center">Create high-fidelity, interactive recordings of any web site you browse</h4>
        </div>
        {
          loaded && auth.user.username && info.data &&
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
        }
      </div>
    );
  }
}

const loadInfo = [
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      const { auth } = getState();

      if(!isLoaded(getState()) && auth.user.username)
        return dispatch(load(auth.user.username));

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  const { auth, info } = state;
  return {
    auth,
    info
  };
};

export default asyncConnect(
  loadInfo,
  mapStateToProps
)(Home);
