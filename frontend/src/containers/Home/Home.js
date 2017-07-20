import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Collapse } from 'react-bootstrap';

import HomepageMessage from 'components/HomepageMessage';
import HomepageAnnouncement from 'components/HomepageAnnouncement';
import RecorderUIStandalone from 'components/RecorderUIStandalone';

import './style.scss';


class Home extends Component {

  static propTypes = {
    auth: PropTypes.object,
    user: PropTypes.object,
    collections: PropTypes.array,
  }

  constructor(props) {
    super(props);

    this.state = {
      introVideoOpen: false
    };
  }

  render() {
    const { auth } = this.props;
    const { introVideoOpen } = this.state;

    const loaded = auth.loaded;

    return (
      <div>
        <div className="row top-buffer">
          <h1 className="text-center"><strong>Webrecorder</strong></h1>
        </div>
        <div className="row tagline">
          <h4 className="text-center">Create high-fidelity, interactive recordings of any web site you browse</h4>
        </div>
        {
          /* anon only
          loaded && auth.user.username && user.data &&
            <HomepageMessage auth={auth} collsCount={collections ? collections.length : 0} />
          */
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


const mapStateToProps = (state) => {
  const { auth, user } = state;
  return {
    auth,
    user
  };
};

export default connect(
  mapStateToProps
)(Home);
