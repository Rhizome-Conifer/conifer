import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import RichTextEditor, { createValueFromString } from 'react-rte/lib/RichTextEditor';
import ButtonGroup from 'react-rte/lib/ui/ButtonGroup';
import IconButton from 'react-rte/lib/ui/IconButton';
import { Button } from 'react-bootstrap';

import './style.scss';


class WYSIWYG extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    active: PropTypes.bool,
    cancel: PropTypes.func,
    className: PropTypes.string,
    editMode: PropTypes.bool,
    externalEditButton: PropTypes.bool,
    initial: PropTypes.string,
    minimal: PropTypes.bool,
    save: PropTypes.func,
    success: PropTypes.bool
  };

  static defaultProps = {
    active: true,
    externalEditButton: false,
    initial: '',
    minimal: false
  };

  constructor(props) {
    super(props);

    const extraElements = ['BLOCK_TYPE_BUTTONS', 'IMAGE_BUTTON', 'HISTORY_BUTTONS'];
    const displayItems = [
      'INLINE_STYLE_BUTTONS',
      'LINK_BUTTONS',
      'BLOCK_TYPE_DROPDOWN'
    ];

    if (!props.minimal) {
      displayItems.splice(2, 0, ...extraElements);
    }

    this.method = 'markdown';
    this.editorConf = {
      display: displayItems,
      INLINE_STYLE_BUTTONS: [
        { label: 'Bold', style: 'BOLD', className: 'custom-css-class' },
        { label: 'Italic', style: 'ITALIC' },
        { label: 'Underline', style: 'UNDERLINE' },
        { label: 'Strikethrough', style: 'STRIKETHROUGH' }
      ],
      BLOCK_TYPE_DROPDOWN: [
        { label: 'Normal', style: 'unstyled' },
        { label: 'Large', style: 'header-one' },
        { label: 'Medium', style: 'header-two' },
        { label: 'Small', style: 'header-three' },
        { label: 'Code', style: 'code-block' }
      ],
      BLOCK_TYPE_BUTTONS: [
        { label: 'UL', style: 'unordered-list-item' },
        { label: 'OL', style: 'ordered-list-item' },
        { label: 'Blockquote', style: 'blockquote' }
      ]
    };

    this.state = {
      renderable: false,
      editorState: createValueFromString(this.props.initial, this.method),
      markdownEdit: false,
      localEditMode: false
    };
  }

  componentDidMount() {
    this.setState({ renderable: true });
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.externalEditButton) {
      // if change in success state from on to off, reset edit mode
      if (this.props.success && !nextProps.success && this.state.localEditMode) {
        this.toggleEditMode();
      }
    }

    // non-save related inital value changed, update editor
    if (this.props.initial !== nextProps.initial && !nextProps.success) {
      if (!this.props.externalEditButton && this.state.localEditMode) {
        this.toggleEditMode();
      }

      this.setState({ editorState: createValueFromString(nextProps.initial, this.method) });
    }
  }

  onChange = editorState => this.setState({ editorState })

  _onChangeSource = (event) => {
    const source = event.target.value;
    const oldValue = this.state.editorState;
    this.setState({
      editorState: oldValue.setContentFromString(source, this.method),
    });
  }

  _cancel = () => {
    this.setState({
      editorState: createValueFromString(this.props.initial, this.method)
    });

    if (this.props.externalEditButton) {
      this.props.cancel();
    } else {
      this.toggleEditMode();
    }
  }
  _save = () => this.props.save(this.state.editorState.toString(this.method))

  toggleEditMode = () => {
    this.setState({ localEditMode: !this.state.localEditMode });
  }

  render() {
    const { canAdmin } = this.context;
    const { className, editMode, externalEditButton } = this.props;
    const { editorState, localEditMode, renderable } = this.state;

    const _editMode = externalEditButton ? editMode : localEditMode;

    return (
      <div className={classNames('wr-editor', className)}>
        <div>
          {
            renderable &&
              <RichTextEditor
                value={editorState}
                onChange={this.onChange}
                toolbarConfig={this.editorConf}
                className={classNames('wr-editor-instance', { 'read-only': !canAdmin || !_editMode })}
                readOnly={!canAdmin || !_editMode}
                customControls={[
                  <ButtonGroup key={2}>
                    <IconButton
                      label="Edit Markdown"
                      iconName="remove-link"
                      focusOnClick={false}
                      className={classNames('markdown-button', {active: this.state.markdownEdit})}
                      onClick={() => { this.setState({ markdownEdit: !this.state.markdownEdit}); }}
                    />
                  </ButtonGroup>
                ]} />
          }
        </div>
        {
          _editMode &&
            <div className="editor-button-row">
              <Button onClick={this._cancel}>Cancel</Button>
              <Button bsStyle={this.props.success ? 'success' : 'default'} onClick={this._save}>
                { this.props.success ? 'Saved..' : 'Save' }
              </Button>
            </div>
        }
        {
          _editMode && this.state.markdownEdit &&
            <textarea
              className={classNames('markdown-editor', { visible: this.state.markdownEdit })}
              onChange={this._onChangeSource}
              value={this.state.editorState.toString(this.method)} />
        }
        {
          canAdmin && !externalEditButton && !_editMode &&
            <Button className="wr-edit-button" bsSize="xs" onClick={this.toggleEditMode}>edit</Button>
        }
      </div>
    );
  }
}

export default WYSIWYG;
