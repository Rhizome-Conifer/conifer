import React, { Component } from 'react';
import classNames from 'classnames';
import { Button, InputGroup, FormGroup, FormControl } from 'react-bootstrap';

import { RemoteBrowserSelect, CollectionDropdown } from 'containers';

import './style.scss';


class RecorderUIStandalone extends Component {

  render() {
    const isOutOfSpace = false;
    const btnClasses = classNames({
      disabled: isOutOfSpace,
    });

    return (
      <form className="start-recording-homepage">
        <InputGroup className="col-md-8 col-md-offset-2 containerized">
          <RemoteBrowserSelect />
          {/* TODO: annoying discrepancy in bootstrap height.. adding fixed height here */}
          <FormControl type="text" name="url" style={{ height: '33px' }} placeholder="URL to record" required disabled={isOutOfSpace} />
          <label htmlFor="url" className="control-label sr-only">Url</label>
          <InputGroup.Button>
            <Button bsStyle="default" className={btnClasses}>
              <span className="glyphicon glyphicon-dot-lg" /> Record
            </Button>
          </InputGroup.Button>
        </InputGroup>
        <FormGroup className="col-md-10 col-md-offset-2 top-buffer form-inline">
          <label htmlFor="recording-name">New Recording Name:&emsp;</label>
          <InputGroup>
            <FormControl id="recording-name" name="rec-title" type="text" bsSize="sm" className="homepage-title" defaultValue={'rec title'} required disabled={isOutOfSpace} />
          </InputGroup>
          {/* TODO: add anon check */}
          <label className="left-buffer" htmlFor="collection">Add to collection:&emsp;</label>
          <CollectionDropdown />
        </FormGroup>
      </form>
    );
  }
}

export default RecorderUIStandalone;
