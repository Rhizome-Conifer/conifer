import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';

import { product } from 'config';
import { upload as uploadErrors } from 'helpers/userMessaging';

import { incrementCollCount } from 'store/modules/auth';

import { CollectionDropdown } from 'containers';
import Modal from 'components/Modal';

import './style.scss';


class UploadUI extends PureComponent {
  static propTypes = {
    activeCollection: PropTypes.string,
    classes: PropTypes.string,
    dispatch: PropTypes.func,
    fromCollection: PropTypes.string,
    history: PropTypes.object,
    wrapper: PropTypes.func
  };

  static defaultProps = {
    classes: 'btn btn-sm btn-primary'
  };

  constructor(props) {
    super(props);

    this.xhr = null;
    this.interval = null;
    this.fileObj = null;
    this.initialState = {
      open: false,
      file: '',
      canCancel: true,
      isUploading: false,
      status: null,
      isIndexing: false,
      progress: 0,
      targetColl: props.fromCollection ? 'chosen' : 'auto'
    };
    this.state = this.initialState;
  }

  triggerFile = () => {
    this.fileField.click();
  }

  filePicker = (evt) => {
    if (evt.target.files.length > 0) {
      this.fileObj = evt.target.files[0]; // eslint-disable-line
      this.setState({ file: this.fileObj.name });
    }
  }

  handleInput = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  submitUpload = () => {
    const { targetColl, file } = this.state;
    const { activeCollection } = this.props;

    if (!file) {
      return false;
    }

    this.xhr = new XMLHttpRequest();
    const target = targetColl === 'chosen' ? activeCollection : '';
    const url = `/_upload?force-coll=${target}&filename=${file}`;

    this.xhr.upload.addEventListener('progress', this.uploadProgress);
    this.xhr.addEventListener('load', this.uploadSuccess);
    this.xhr.addEventListener('loadend', this.uploadComplete);

    this.xhr.open('PUT', url, true);


    this.setState({
      isUploading: true,
      status: 'Uploading...'
    });

    this.xhr.send(this.fileObj);

    return this.xhr;
  }

  uploadProgress = (evt) => {
    const progress = Math.round((50.0 * evt.loaded) / evt.total);

    if (evt.loaded >= evt.total) {
      this.setState({ canCancel: false, progress });
    } else {
      this.setState({ progress });
    }
  }

  uploadSuccess = evt => this.setState({ progress: 50 })

  indexResponse = (data) => {
    const stateUpdate = {};

    if (data.filename && data.filename !== this.state.file) {
      stateUpdate.file = data.filename;
    }

    if (data.total_files > 1) {
      stateUpdate.status = `Indexing ${data.total_files - data.files} of ${data.total_files}`;
    }

    if (data.size && data.total_size) {
      stateUpdate.progress = 50 + Math.round((50 * data.size) / data.total_size);
    }

    // update ui
    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }

    if (data.size >= data.total_size && data.done) {
      clearInterval(this.interval);
      this.indexingComplete(data.user, data.coll);
    }
  }

  indexingComplete = (user, coll) => {
    this.close();
    if (this.state.targetColl !== 'chosen') {
      this.props.dispatch(incrementCollCount(1));
    }
    this.props.history.push(`/${user}/${coll}/manage`);
  }

  indexing = (data) => {
    this.setState({ canCancel: false, status: 'Indexing...' });

    const url = `/_upload/${data.upload_id}?user=${data.user}`;

    this.interval = setInterval(() => {
      fetch(url, { headers: new Headers({ 'x-requested-with': 'XMLHttpRequest' }) })
        .then(res => res.json())
        .then(this.indexResponse);
    }, 75);
  }

  uploadComplete = (evt) => {
    if (!this.xhr) {
      return;
    }

    const data = JSON.parse(this.xhr.responseText);

    if (data && data.upload_id) {
      return this.indexing(data);
    }

    this.setState({
      canCancel: true,
      status: uploadErrors[data.error] || 'Error Encountered'
    });
  }

  open = () => this.setState({ open: true })

  close = () => {
    if (this.state.isUploading && this.xhr && this.state.canCancel) {
      this.xhr.upload.removeEventListener('progress', this.uploadProgress);
      this.xhr.removeEventListener('load', this.uploadSuccess);
      this.xhr.removeEventListener('loadend', this.uploadComplete);
      this.xhr.abort();
    }

    this.setState(this.initialState);
  }

  render() {
    const { classes } = this.props;
    const { file, isUploading, progress, status, targetColl } = this.state;

    const modalHeader = (
      <h4>Upload Web Archive to { product }</h4>
    );

    const Wrapper = this.props.wrapper || Button;

    const modalFooter = (
      <React.Fragment>
        <Button onClick={this.close} disabled={!this.state.canCancel}>Cancel</Button>
        <Button onClick={this.submitUpload} disabled={isUploading} bsStyle="success">Upload</Button>
      </React.Fragment>
    );

    return (
      <React.Fragment>
        <Wrapper className={classes} onClick={this.open}>
          { this.props.children || 'Upload'}
        </Wrapper>
        <Modal
          closeCb={this.close}
          dialogClassName={classNames({ 'wr-uploading': isUploading })}
          footer={modalFooter}
          header={modalHeader}
          propsPass={{ backdrop: isUploading ? 'static' : true }}
          visible={this.state.open}>
          <label htmlFor="upload-file">WARC/ARC file to upload: </label>

          <div className="input-group">
            <input type="text" id="upload-file" value={file} name="upload-file-text" className="form-control" placeholder="Click Pick File to select a web archive file" required readOnly style={{ backgroundColor: 'white' }} />
            <span className="input-group-btn">
              <button aria-label="pick file..." type="button" className="btn btn-default" onClick={this.triggerFile}>
                <span className="glyphicon glyphicon-file glyphicon-button" />Pick File...
              </button>
            </span>
            <input type="file" onChange={this.filePicker} ref={(obj) => { this.fileField = obj; }} name="uploadFile" style={{ display: "none" }} accept=".gz,.warc,.arc,.har" />
          </div>

          <div className="wr-radio-target">
            <input type="radio" name="targetColl" id="target-auto" value="auto" checked={targetColl === 'auto'} onChange={this.handleInput} />
            <label htmlFor="target-auto">Automatically create new collection.</label>
          </div>

          <div className="wr-radio-target">
            <input type="radio" name="targetColl" id="target-chosen" value="chosen" checked={targetColl === 'chosen'} onChange={this.handleInput} />
            <label htmlFor="target-chosen">Add to existing collection:&emsp;</label>
            <CollectionDropdown
              canCreateCollection={false}
              fromCollection={this.props.fromCollection}
              label="" />
          </div>

          {
            isUploading &&
              <React.Fragment>
                <div className="wr-progress-bar">
                  <div className="progress" style={{ width: `${progress || 0}%` }} />
                  <div className="progress-readout">{ `${progress || 0}%` }</div>
                </div>
                {
                  status &&
                    <p>{status}</p>
                }
              </React.Fragment>
          }
        </Modal>
      </React.Fragment>
    );
  }
}

export default UploadUI;
