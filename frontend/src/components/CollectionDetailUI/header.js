import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { defaultCollDesc } from 'config';

import WYSIWYG from 'components/WYSIWYG';
import { PencilIcon } from 'components/icons';


class CollDetailHeader extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  }

  static propTypes = {
    activeList: PropTypes.bool,
    collection: PropTypes.object,
    list: PropTypes.object,
    saveDescription: PropTypes.func,
    saveSuccess: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      edit: false
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.saveSuccess && !nextProps.saveSuccess) {
      this.setState({ edit: false });
    }
  }

  toggleEdit = () => this.setState({ edit: !this.state.edit })

  _saveDesc = (desc) => {
    const { activeList, collection, list, saveDescription } = this.props;
    if (activeList) {
      saveDescription(collection.get('user'), collection.get('id'), desc, list.get('id'));
    } else {
      saveDescription(collection.get('user'), collection.get('id'), desc);
    }
  }

  render() {
    const { activeList, collection, list } = this.props;
    const { edit } = this.state;

    return (
      <header>
        <h1>{collection.get('title')}{activeList ? ` > ${list.get('title')}` : null }</h1>
        <hr />
        <div className="desc-container">
          <WYSIWYG
            editMode={edit}
            initial={activeList ? list.get('desc') : collection.get('desc') || defaultCollDesc}
            cancel={this.toggleEdit}
            save={this._saveDesc}
            success={this.props.saveSuccess} />
          {
            this.context.canAdmin && !edit &&
              <Button bsSize="xs" className="desc-edit-button" onClick={this.toggleEdit}>edit</Button>
          }
        </div>
      </header>
    );
  }
}


export default CollDetailHeader;
