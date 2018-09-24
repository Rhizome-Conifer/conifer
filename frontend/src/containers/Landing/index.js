import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { batchActions } from 'redux-batched-actions';
import { Button, FormControl, ProgressBar } from 'react-bootstrap';

import { setHost, setSource } from 'redux/modules/appSettings';
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

    this.state = {
      datUrl: '',
      initializing: false,
      progress: 0,
      source: ''
    };
  }

  componentDidMount() {
    ipcRenderer.once('initializing', (evt, { src }) => {
      this.setState({ initializing: true, source: src });
    });
    ipcRenderer.once('indexing', (evt, data) => {
      this.props.dispatch(batchActions([
        setHost(rts(data.host)),
        setSource(data.source)
      ]));

      this.props.history.push(data.source.startsWith('dat') ? '/local/collection' : '/indexing');
    });

    ipcRenderer.on('indexProgress', this.setProgress);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('indexProgress', this.setProgress);
  }

  setProgress = (evt, data) => {
    this.setState({ progress: data.perct });
  }

  handleInput = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  syncDat = () => {
    if (this.state.datUrl) {
      ipcRenderer.send('sync-dat', this.state.datUrl);
    }
  }

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this.syncDat();
    }
  }

  render() {
    const { initializing, progress, source } = this.state;

    const allowDat = JSON.parse(process.env.ALLOW_DAT);
    const loadIndicator = source === 'dat' ?
      (<div className="dat-container">
        <h4>Downloading from peer-to-peer Dat network:</h4>
        <ProgressBar now={this.state.progress} label={`${progress}%`} bsStyle="success" />
      </div>) :
      <img src={require('shared/images/loading.svg')} id="loadingGif" alt="loading" />

    return (
      <div id="landingContainer">
        {
          initializing ?
            loadIndicator :
            <React.Fragment>
              <div className="bigOpen">
                <button onClick={openFile}>
                  <object id="loadWarc" data={require('shared/images/Load_WARC.svg')} type="image/svg+xml">load</object>
                </button>
              </div>
              {
                allowDat &&
                  <div className="dat-url">
                    Or via dat:
                    <div className="dat-input">
                      <FormControl type="text" name="datUrl" onChange={this.handleInput} onKeyPress={this.submitCheck} value={this.state.datUrl} placeholder="Enter a dat:// url" />
                      <Button bsStyle="primary" onClick={this.syncDat}>Sync</Button>
                    </div>
                  </div>
              }
            </React.Fragment>
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
