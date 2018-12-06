import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { basename } from 'path';

import Modal from 'components/Modal';

import './style.scss';

const { ipcRenderer } = window.require('electron');


class Indexing extends Component {

  static contextTypes = {
    router: PropTypes.object
  };

  static propTypes = {
    dispatch: PropTypes.func,
    history: PropTypes.object,
    host: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.interval = null;
    this.finishedCount = 0;
    this.state = {
      data: null,
      debugModal: false,
      stalled: false,
      stdout: null
    };
  }

  componentWillMount() {
    //this.props.dispatch(clearColl());
  }

  componentDidMount() {
    const { host } = this.props;
    const reqUrl = `${host}/_upload/@INIT?user=local`;

    this.interval = setInterval(() => {
      fetch(reqUrl).then(res => res.json())
                   .then(this.displayProgress)
                   .catch(err => console.log(err));
    }, 250);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  displayProgress = (data) => {
    if (data.done) {
      clearInterval(this.interval);
      this.props.history.replace('/local/collection');
    } else {
      if (data.size === data.total_size) {
        if (this.finishedCount++ > 5 && !this.state.stalled) {
          this.setState({ stalled: true });
          ipcRenderer.on('async-response', this.handleVersionResponse);
          ipcRenderer.send('async-call');
        }
      }

      this.setState({
        file: basename(data.filename),
        progress: (((data.size / data.total_size) * 100) + 0.5) | 0
      });
    }
  }

  handleVersionResponse = (evt, arg) => {
    const { stdout } = arg;
    this.setState({ stdout });
  }

  toggleModal = () => {
    this.setState({ debugModal: !this.state.debugModal });
  }

  render() {
    const { file, progress } = this.state;
    return (
      <div id="indexingContainer">
        <img className="logo" src={require('shared/images/webrecorder_player_text.svg')} alt="Webrecorder header" />
        <div className="progress-window">
          <h1>Please wait while the archive is indexed...</h1>
          <h3>{ file }</h3>
          <div className="indexing-bar">
            <div className="progress" style={{ width: `${progress || 0}%` }} />
            <div className="progress-readout">{ `${progress || 0}%` }</div>
          </div>
          {
            this.state.stalled &&
              <React.Fragment>
                <div className="stalled">Oops, it seems that indexing has stalled. <button className="button-link" type="button" onClick={this.toggleModal}>Additional info</button></div>
                <Modal
                  dialogClassName="stalled-modal"
                  header={<h5>Extra Debug Info</h5>}
                  closeCb={this.toggleModal}
                  visible={this.state.debugModal}>
                  <p dangerouslySetInnerHTML={{ __html: this.state.stdout || 'No additional info' }} />
                </Modal>
              </React.Fragment>
          }
        </div>

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

const mapStateToProps = ({ app }) => {
  return {
    host: app.getIn(['appSettings', 'host'])
  };
};

export default withRouter(connect(mapStateToProps)(Indexing));
