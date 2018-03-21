import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { defaultCollDesc } from 'config';

import InlineEditor from 'components/InlineEditor';
import WYSIWYG from 'components/WYSIWYG';
import { PencilIcon } from 'components/icons';


class CollDetailHeader extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.bool,
    collection: PropTypes.object,
    list: PropTypes.object,
    listEdited: PropTypes.bool,
    saveDescription: PropTypes.func,
    saveSuccess: PropTypes.bool,
    saveListEdit: PropTypes.func
  };

  editTitle = (title) => {
    console.log('saving..', title);
  }

  saveCollTitle = (title) => {}
  saveListTitle = (title) => {
    const { collection, list } = this.props;
    this.props.saveListEdit(collection.get('user'), collection.get('id'), list.get('id'), { title });
  }

  saveDesc = (desc) => {
    const { activeList, collection, list, saveDescription, saveListEdit } = this.props;
    if (activeList) {
      saveListEdit(collection.get('user'), collection.get('id'), list.get('id'), { desc });
    } else {
      saveDescription(collection.get('user'), collection.get('id'), desc);
    }
  }

  render() {
    const { activeList, collection, list } = this.props;

    return (
      <header>
        <InlineEditor
          initial={collection.get('title')}
          onSave={this.editTitle}>
          <h1>{collection.get('title')}</h1>
        </InlineEditor>
        {
          activeList &&
            <React.Fragment>
              <h1>&nbsp;>&nbsp;</h1>
              <InlineEditor
                initial={list.get('title')}
                onSave={this.saveListTitle}
                success={this.props.listEdited}>
                <h1>{list.get('title')}</h1>
              </InlineEditor>
            </React.Fragment>
        }
        <hr />
        <div className="desc-container">
          <WYSIWYG
            initial={activeList ? list.get('desc') : collection.get('desc') || defaultCollDesc}
            save={this.saveDesc}
            success={this.props.saveSuccess} />
        </div>
      </header>
    );
  }
}


export default CollDetailHeader;
