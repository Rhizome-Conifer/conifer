import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, Dropdown, DropdownButton, MenuItem } from 'react-bootstrap';

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

    const button = isPublic ? <span><GlobeIcon /><span className="hidden-xs"> Public</span></span> : <span><LockIcon /><span className="hidden-xs"> Private</span></span>;

    return (
      <div className="wr-coll-visibility">
        <Dropdown id="visibility-menu">
          <Dropdown.Toggle variant="outline-secondary" bsPrefix={classNames('dropdown-toggle', { 'is-public': isPublic, 'is-private': !isPublic })}>{button}</Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={!isPublic ? this.setPublic : undefined} disabled={isPublic}><GlobeIcon /> Set {label} Public</Dropdown.Item>
            <Dropdown.Item onClick={isPublic ? this.setPrivate : undefined} disabled={!isPublic}><LockIcon /> Set {label} Private</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  }
}


export default PublicSwitch;
