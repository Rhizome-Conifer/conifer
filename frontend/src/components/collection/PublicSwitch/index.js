import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, DropdownButton, MenuItem } from 'react-bootstrap';

import { GlobeIcon, LockIcon } from 'components/icons';

import './style.scss';


class PublicSwitch extends PureComponent {
  static propTypes = {
    callback: PropTypes.func,
    isPublic: PropTypes.bool,
    label: PropTypes.string
  };

  setPrivate = () => this.props.callback(false);

  setPublic = () => this.props.callback(true);

  render() {
    const { isPublic, label } = this.props;

    const button = isPublic ? <span><GlobeIcon /> Public {label}</span> : <span className="is-private"><LockIcon /> Private {label}</span>;

    return (
      <div className="wr-coll-visibility">
        <DropdownButton noCaret id="visibility-menu" className={classNames('rounded', { 'is-public': isPublic })} title={button}>
          <MenuItem onClick={this.setPublic} disabled={isPublic}><GlobeIcon /> Set {label} Public</MenuItem>
          <MenuItem onClick={this.setPrivate} disabled={!isPublic}><LockIcon /> Set {label} Private</MenuItem>
        </DropdownButton>
      </div>
    );
  }
}


export default PublicSwitch;
