import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { mdToDraftjs, draftjsToMd } from 'draftjs-md-converter';
import { Editor, EditorState, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import ReactMarkdown from 'react-markdown';

import { PencilIcon } from 'components/icons';


class CollDetailHeader extends Component {

  static propTypes = {
    activeList: PropTypes.bool,
    collection: PropTypes.object,
    list: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      edit: false,
      editorState: EditorState.createEmpty()
    };
  }

  handleChange = editorState => this.setState({ editorState })
  toggleEdit = () => this.setState({ edit: !this.state.edit })

  render() {
    const { activeList, collection, list } = this.props;
    const { edit, editorState } = this.state;

    return (
      <header>
        <h1>{collection.get('title')}{activeList ? ` > ${list.get('title')}` : null }</h1>
        <hr />
        {
          edit ?
            <Editor editorState={editorState} onChange={this.handleChange} /> :
            <ReactMarkdown className="coll-desc" source={activeList ? list.get('desc') : collection.get('desc')} />
        }
        <button className="borderless" onClick={this.toggleEdit}><PencilIcon /></button>
      </header>
    );
  }
}


export default CollDetailHeader;
