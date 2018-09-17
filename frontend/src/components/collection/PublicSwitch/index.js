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

    const button = isPublic ? <span><GlobeIcon /><span className="hidden-xs"> Public</span></span> : <span className="is-private"><LockIcon /><span className="hidden-xs"> Private</span></span>;

    return (
      <div className="wr-coll-visibility">
        <DropdownButton noCaret id="visibility-menu" className={classNames('rounded', { 'is-public': isPublic })} title={button}>
          <MenuItem onClick={!isPublic ? this.setPublic : undefined} disabled={isPublic}><GlobeIcon /> Set {label} Public</MenuItem>
          <MenuItem onClick={isPublic ? this.setPrivate : undefined} disabled={!isPublic}><LockIcon /> Set {label} Private</MenuItem>
        </DropdownButton>
      </div>
    );
  }
}


export default PublicSwitch;
