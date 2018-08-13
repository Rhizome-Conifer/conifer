import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { defaultListDesc } from 'config';
import { getListLink } from 'helpers/utils';

import InlineEditor from 'components/InlineEditor';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon } from 'components/icons';

import './style.scss';


class ListHeaderUI extends PureComponent {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    editList: PropTypes.func,
    history: PropTypes.object,
    list: PropTypes.object,
    listEdited: PropTypes.bool,
    location: PropTypes.object
  };

  editListTitle = (title) => {
    const { collection, editList, list } = this.props;
    editList(collection.get('owner'), collection.get('id'), list.get('id'), { title });
  }

  editDesc = (desc) => {
    const { collection, list, editList } = this.props;
    editList(collection.get('owner'), collection.get('id'), list.get('id'), { desc });
  }

  setPublic = (bool) => {
    const { collection, editList, list } = this.props;
    editList(collection.get('owner'), collection.get('id'), list.get('id'), { public: bool });
  }

  startReplay = () => {
    const { collection, history, list } = this.props;
    const first = list.getIn(['bookmarks', 0]);

    if (first) {
      history.push(`${getListLink(collection, list)}/b${first.get('id')}/${first.get('timestamp')}/${first.get('url')}`);
    }
  }

  render() {
    const { canAdmin } = this.context;
    const {list } = this.props;

    return (
      <div className="wr-list-header">
        <span className="banner"><ListIcon /> LIST</span>
        <div className="heading-container">
          <InlineEditor
            initial={list.get('title')}
            onSave={this.editListTitle}
            readOnly={!canAdmin}
            success={this.props.listEdited}>
            <h1>{list.get('title')}</h1>
          </InlineEditor>
        </div>
        <Truncate height={75} propPass="clickToEdit">
          <WYSIWYG
            initial={list.get('desc')}
            key={list.get('id')}
            onSave={this.editDesc}
            placeholder={defaultListDesc}
            success={this.props.listEdited} />
        </Truncate>
      </div>
    );
  }
}


export default ListHeaderUI;
