import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, FormGroup, ControlLabel, FormControl, Radio } from 'react-bootstrap';

import { apiFetch } from 'helpers/utils';

import { newAutomation, queueAutomation, toggleAutomation, toggleModal } from 'store/modules/automation';
import { load as loadColl } from 'store/modules/collection';

import Modal from 'components/Modal';

import { publicIP } from 'config';

import './style.scss';


class Automation extends Component {
  static propTypes = {
    active: PropTypes.bool,
    autoId: PropTypes.string,
    autoQueued: PropTypes.bool,
    collection: PropTypes.object,
    createAutomation: PropTypes.func,
    refresh: PropTypes.func,
    stopAutomation: PropTypes.func,
    toggleAutomationModal: PropTypes.func,
    visible: PropTypes.bool,
    workers: PropTypes.array
  };

  constructor(props) {
    super(props);

    this.refreshHandle = null;
    this.pingHandle = null;
    this.state = {
      autoHops: 0,
      listAutoLinks: '',
      num_browsers: 1,
      scope: 'single-page'
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.autoQueued && !prevProps.autoQueued) {
      // setTimeout(this.closeAutoModal, 1500);

      this.refreshHandle = setInterval(this.refresh, 2500);
    }
  }

  componentWillUnmount() {
    clearInterval(this.refreshHandle);
    clearInterval(this.pingHandle);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  refresh = () => this.props.refresh()

  sendStopAutomation = () => {
    const { autoId, collection } = this.props;
    this.props.stopAutomation(collection.get('owner'), collection.get('id'), autoId);
    clearInterval(this.refreshHandle);
  }

  startAutomation = () => {
    const { collection } = this.props;
    const { autoHops, listAutoLinks, num_browsers, scope } = this.state;
    const links = listAutoLinks.trim().split('\n');
    this.props.createAutomation(collection.get('owner'), collection.get('id'), links, parseInt(autoHops, 10), scope, parseInt(num_browsers, 10));
  }

  render() {
    const { scope } = this.state;

    return (
      <Modal
        visible={this.props.visible}
        closeCb={this.props.toggleAutomationModal}
        header={<h4>New Automation</h4>}
        footer={
          <React.Fragment>
            <Button style={{ marginRight: 5 }} onClick={this.toggleAutomationModal}>Close</Button>
            {
              this.props.active &&
                <Button style={{ marginRight: 5 }} onClick={this.sendStopAutomation}>Stop Automation</Button>
            }
            <Button onClick={this.startAutomation} disabled={this.props.autoQueued} bsStyle={this.props.autoQueued ? 'success' : 'primary'}>{`Create${this.props.autoQueued ? 'd!' : ''}`}</Button>
          </React.Fragment>
        }>
        <React.Fragment>
          <FormGroup>
            <ControlLabel>Number of Workers:</ControlLabel>
            <FormControl
              type="text"
              name="num_browsers"
              value={this.state.num_browsers}
              onChange={this.handleChange} />
          </FormGroup>
          <FormGroup bsClass="form-group automation-scope">
            <ControlLabel>Scope:</ControlLabel>
            <Radio name="scope" onChange={this.handleChange} value="single-page" checked={scope === 'single-page'} inline>
              Single Page
            </Radio>
            <Radio name="scope" onChange={this.handleChange} value="same-domain" checked={scope === 'same-domain'} inline>
              Same Domain
            </Radio>
            <Radio name="scope" onChange={this.handleChange} value="all-links" checked={scope === 'all-links'} inline>
              All Links
            </Radio>
          </FormGroup>
          <FormGroup controlId="formControlsTextarea">
            <ControlLabel>Links</ControlLabel>
            <FormControl
              componentClass="textarea"
              name="listAutoLinks"
              value={this.state.listAutoLinks}
              placeholder="http://example.com"
              style={{ minHeight: '200px' }}
              onChange={this.handleChange} />
          </FormGroup>

          {
            this.props.workers.size > 0 &&
              <FormGroup>
                <ControlLabel>Automation Workers:</ControlLabel>
                <FormControl.Static>
                  {
                    this.props.workers.map((worker, idx) => <a href={`http://${publicIP}:9020/attach/${worker}`} key={worker} target="_blank" style={{display: 'block'}}>Worker {idx + 1}</a>)
                  }
                </FormControl.Static>
              </FormGroup>
          }

        </React.Fragment>
      </Modal>
    );
  }
}

const mapStateToProps = ({ app }) => {
  return {
    active: app.getIn(['automation', 'active']),
    autoId: app.getIn(['automation', 'autoId']),
    autoQueued: app.getIn(['automation', 'queued']),
    visible: app.getIn(['automation', 'show']),
    workers: app.getIn(['automation', 'workers'])
  };
};

const mapDispatchToProps = (dispatch, { collection }) => {
  return {
    refresh: () => dispatch(loadColl(collection.get('owner'), collection.get('id'))),
    createAutomation: (user, coll, bookmarks, hops, scope, num_browsers) => {
      let autoId;
      return dispatch(newAutomation(user, coll, hops, scope, num_browsers))
        .then(({ auto }) => { autoId = auto; return dispatch(queueAutomation(user, coll, autoId, bookmarks)); })
        .then(() => dispatch(toggleAutomation('start', user, coll, autoId)))
        .then(() => dispatch(loadColl(user, coll)));
    },
    stopAutomation: (user, coll, aid) => dispatch(toggleAutomation('stop', user, coll, aid)),
    toggleAutomationModal: () => dispatch(toggleModal())
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Automation);
