import React, { Component } from 'react';
import classNames from 'classnames';
import { Button, Glyphicon } from 'react-bootstrap';

import RemoteBrowserSelect from 'components/RemoteBrowserSelect';
import './style.scss';


class RecorderUIStandalone extends Component {

  render() {
    const isOutOfSpace = false;
    const btnClasses = classNames({
      disabled: isOutOfSpace,
    });

    return (
      <form className="start-recording-homepage">
        <div className="input-group col-md-8 col-md-offset-2 containerized">
          <RemoteBrowserSelect />
          <input name="url" type="text" className="form-control" placeholder="URL to record" required disabled={isOutOfSpace} />
          <label htmlFor="url" className="control-label sr-only">Url</label>
          <span className="input-group-btn">
            <Button bsStyle="default" className={btnClasses}>
              <span className="glyphicon glyphicon-dot-lg" /> Record
            </Button>
          </span>
        </div>
      </form>
    );
  }
}

export default RecorderUIStandalone;
