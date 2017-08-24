import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, InputGroup, FormGroup, FormControl } from 'react-bootstrap';

import { CollectionDropdown, ExtractWidget,
         RemoteBrowserSelect } from 'containers';

import './style.scss';


class StandaloneRecorderUI extends Component {
  static propTypes = {
    extractable: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      url: '',
    };
  }

  urlInput = (evt) => {
    evt.preventDefault();
    this.setState({ url: evt.target.value });
  }

  startRecording = (evt) => {
    evt.preventDefault();
  }

  render() {
    const { extractable } = this.props;
    const { url } = this.state;

    const isOutOfSpace = false;
    const btnClasses = classNames({
      disabled: isOutOfSpace,
    });

    return (
      <form className="start-recording-homepage" onSubmit={this.startRecording}>
        <InputGroup className="col-md-8 col-md-offset-2 containerized">

          <RemoteBrowserSelect />

          {/* TODO: annoying discrepancy in bootstrap height.. adding fixed height here */}
          <FormControl type="text" name="url" onChange={this.urlInput} style={{ height: '33px' }} value={url} placeholder="URL to record" required disabled={isOutOfSpace} />
          <label htmlFor="url" className="control-label sr-only">Url</label>

          {
            !extractable &&
              <div className="input-group-btn record-action">
                <Button bsStyle="default" type="submit" className={btnClasses}>
                  <span className="glyphicon glyphicon-dot-lg" /> Record
                </Button>
              </div>
          }

          <ExtractWidget
            active={false}
            url={url} />

        </InputGroup>
        <FormGroup className="col-md-10 col-md-offset-2 top-buffer form-inline">

          <label htmlFor="recording-name">New Recording Name:&emsp;</label>
          <InputGroup>
            <FormControl id="recording-name" name="rec-title" type="text" bsSize="sm" className="homepage-title" defaultValue={'rec title'} required disabled={isOutOfSpace} />
          </InputGroup>

          <CollectionDropdown />

        </FormGroup>
      </form>
    );
  }
}

export default StandaloneRecorderUI;
