import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { defaultBookmarkDesc, untitledEntry } from 'config';

import InlineEditor from 'components/InlineEditor';
import WYSIWYG from 'components/WYSIWYG';

import './style.scss';


class ListMetadataUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeBookmark: PropTypes.object,
    bkEdited: PropTypes.bool,
    collection: PropTypes.object,
    list: PropTypes.object,
    saveBookmarkEdit: PropTypes.func
  };

  saveEdit = (data) => {
    const { activeBookmark, collection, list } = this.props;
    this.props.saveBookmarkEdit(
      collection.get('user'),
      collection.get('id'),
      list.get('id'),
      activeBookmark.get('id'),
      data
    );
  }

  editBookmarkTitle = title => this.saveEdit({ title })
  editBookmarkDesc = desc => this.saveEdit({ desc })

  render() {
    const { activeBookmark } = this.props;

    return (
      <div className="sidebar-module wr-list-metadata">
        {
          activeBookmark &&
            <React.Fragment>
              <InlineEditor
                blockDisplay
                initial={activeBookmark.get('title') || untitledEntry}
                onSave={this.editBookmarkTitle}
                success={this.props.bkEdited}>
                <h4>{activeBookmark.get('title')}</h4>
              </InlineEditor>
              <WYSIWYG
                minimal
                initial={activeBookmark.get('desc') || defaultBookmarkDesc}
                save={this.editBookmarkDesc}
                success={this.props.bkEdited} />
            </React.Fragment>
        }
      </div>
    );
  }
}

export default ListMetadataUI;
