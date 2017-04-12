import React, { Component, PropTypes } from 'react';
import { asyncConnect } from 'redux-connect';
import { Link } from 'react-router';

import { isLoaded, load } from 'redux/modules/info';

import HomepageMessage from 'components/HomepageMessage';
import RecorderUIStandalone from 'components/RecorderUIStandalone';


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
            <HomepageMessage auth={auth} info={info} />
        }
        <div className="row top-buffer-lg bottom-buffer-lg">
          <RecorderUIStandalone />
        </div>
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
