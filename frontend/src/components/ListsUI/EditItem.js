import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { Overlay, Tooltip } from 'react-bootstrap';

import OutsideClick from 'components/OutsideClick';
import { PencilIcon, TrashIcon } from 'components/icons';


class EditItem extends Component {
  static propTypes = {
    list: PropTypes.object,
    editList: PropTypes.func,
    deleteListCallback: PropTypes.func,
    editSuccess: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      confirmDelete: false,
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

  confirmDelete = () => {
    if (this.state.confirmDelete) {
      this.setState({ confirmDelete: false });
      console.log('deleting', this.props.list.get('id'));
      this.props.deleteListCallback(this.props.list.get('id'));
    }

    this.setState({ confirmDelete: true });
  }

  editListItem = () => {
    const { title } = this.state;
    const { list, editList } = this.props;

    if (title && title !== list.get('title')) {
      editList(list.get('id'), title);
    }
  }

  outsideClickCheck = (evt) => {
    // if delete prompt is up, cancel it
    if (this.state.confirmDelete) {
      this.setState({ confirmDelete: false });
    }
  }

  render() {
    const { confirmDelete, hasChanges, title } = this.state;
    return (
      <li>
        <OutsideClick handleClick={this.outsideClickCheck} inlineBlock>
          <button ref={(obj) => { this.target = obj; }} className="borderless remove-list" onClick={this.confirmDelete}><TrashIcon /></button>
        </OutsideClick>
        <Overlay container={this} placement="bottom" target={this.target} show={confirmDelete}>
          <Tooltip placement="bottom" id="confirm-remove">Confirm Delete</Tooltip>
        </Overlay>
        <input name="title" className="borderless-input" onChange={this.handleInput} value={title} />
        <button className="borderless" onClick={this.editListItem} disabled={!hasChanges}><PencilIcon /></button>
      </li>
    );
  }
}

export default EditItem;
