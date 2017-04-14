import React, { Component, PropTypes } from 'react';
import { asyncConnect } from 'redux-connect';
import { Link } from 'react-router';
import { Collapse } from 'react-bootstrap';

import { isLoaded, load } from 'redux/modules/info';

import HomepageMessage from 'components/HomepageMessage';
import HomepageAnnouncement from 'components/HomepageAnnouncement';
import RecorderUIStandalone from 'components/RecorderUIStandalone';

import './style.scss';


class Home extends Component {

  static propTypes = {
    auth: PropTypes.object,
    info: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      introVideoOpen: false
    };
  }

  render() {
    const { auth, info } = this.props;
    const { introVideoOpen } = this.state;

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
        <HomepageAnnouncement />
        <div className="tutorial col-xs-10 col-xs-push-1">
          <button onClick={() => this.setState({ introVideoOpen: !introVideoOpen })}>
            {
              introVideoOpen ?
                <span className="glyphicon glyphicon-triangle-bottom" /> :
                <span className="glyphicon glyphicon-triangle-right" />
            }
            &nbsp;Watch Webrecorder Introductory Video
          </button>
          <Collapse in={introVideoOpen}>
            <div>
              <iframe width="854" height="480" src="https://www.youtube.com/embed/n3SqusABXEk" allowFullScreen />
            </div>
          </Collapse>
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
