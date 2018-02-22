import React, { Component } from 'react';
import PropTypes from 'prop-types';


class EditItem extends Component {
  static propTypes = {
    list: PropTypes.object,
    editList: PropTypes.func,
    removeList: PropTypes.func,
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

  editListItem = () => {
    const { title } = this.state;
    const { list, editList } = this.props;

    if (title && title !== list.get('title')) {
      editList(list.get('id'), title);
    }
  }

  removeListItem = () => {
    this.props.removeList(this.props.list.get('id'));
  }

  render() {
    const { hasChanges, title } = this.state;
    return (
      <li>
        <button className="borderless">🗑</button>
        <input name="title" className="borderless-input" onChange={this.handleInput} value={title} />
        <button className="borderless" onClick={this.editListItem} disabled={!hasChanges}>✎</button>
      </li>
    );
  }
}

export default EditItem;
