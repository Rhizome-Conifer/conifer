import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { setHost } from 'redux/modules/appSettings';
import { rts } from 'helpers/utils';
import { openFile } from 'helpers/playerUtils';

import './style.scss';

const { ipcRenderer } = window.require('electron');


class Landing extends Component {

  static propTypes = {
    dispatch: PropTypes.func,
    history: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = { initializing: false };
  }

  componentDidMount() {
    ipcRenderer.once('initializing', () => this.setState({ initializing: true }));
    ipcRenderer.once('indexing', (evt, data) => {
      this.props.dispatch(setHost(rts(data.host)));
      this.props.history.push('/indexing');
    });
  }

  render() {
    const { initializing } = this.state;

    return (
      <div id="landingContainer">
        {
          initializing ?
            <img src={require('shared/images/loading.svg')} id="loadingGif" alt="loading" /> :
            <div className="bigOpen">
              <button onClick={openFile}>
                <object id="loadWarc" data={require('shared/images/Load_WARC.svg')} type="image/svg+xml">load</object>
              </button>
            </div>
        }

        <div className="projectByRhizome">
          <p>
            A project by<br />
            <img src={require('shared/images/Rhizome-Logo_med.png')} alt="rhizome logo" />
          </p>
        </div>
      </div>
    );
  }
}


export default withRouter(connect()(Landing));
