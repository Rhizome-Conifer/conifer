import React, { Component } from 'react';
import PropTypes from 'prop-types';

import RemoveWidget from 'components/RemoveWidget';
import { CheckIcon, PencilIcon } from 'components/icons';


class EditItem extends Component {
  static propTypes = {
    list: PropTypes.object,
    edited: PropTypes.bool,
    editListCallback: PropTypes.func,
    deleteListCallback: PropTypes.func,
    editSuccess: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      title: this.props.list.get('title'),
      hasChanges: false
    };
  }

  handleInput = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value,
      hasChanges: evt.target.value.length && true
    });
  }

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this.editListItem();
    }
  }

  confirmDelete = () => {
    this.props.deleteListCallback(this.props.list.get('id'));
  }

  editListItem = () => {
    const { title } = this.state;
    const { list, editListCallback } = this.props;

    if (title && title !== list.get('title')) {
      editListCallback(list.get('id'), { title });
    }
  }

  render() {
    const { hasChanges, title } = this.state;
    const { edited } = this.props;

    return (
      <li>
        <RemoveWidget usePortal callback={this.confirmDelete} placement="left" scrollCheck=".lists-modal-list" />
        <input name="title" className="borderless-input" onBlur={this.editListItem} onKeyPress={this.submitCheck} onChange={this.handleInput} value={title} />
        {
          edited ?
            <button className="borderless"><CheckIcon success /></button> :
            <button className="borderless" onClick={this.editListItem} disabled={!hasChanges} title="Save edit"><PencilIcon /></button>
        }
      </li>
    );
  }
}

export default EditItem;
