import React, { Component } from 'react';
import PropTypes from 'prop-types';

class EditableString extends Component {
  static propTypes = {
    string: PropTypes.string,
    contentType: PropTypes.string,
    className: PropTypes.string,
    icon: PropTypes.boolean
  };

  static defaultProps = {
    string: '',
    className: '',
    icon: true
  }

  render() {
    const { className, contentType, icon, string } = this.props;
    const desc = `Edit ${contentType} ${string}`;

    let editIcon = '';
    if(className) {
      editIcon = `${className}-edit-icon`;
    }

    return (
      <div>
        <span className={className}>{ string }</span>
        { icon &&
          <button
            type="button"
            className={`btn btn-default btn-xs icon-button ${editIcon}`}
            aria-label={desc}
            title={desc}>
            <span className="glyphicon glyphicon-pencil" aria-hidden="true" />
          </button>
        }
      </div>
    );
  }
}

export default EditableString;
