import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

import { defaultListDesc } from 'config';
import { getCollectionLink, getListLink } from 'helpers/utils';

import InlineEditor from 'components/InlineEditor';
import PublicSwitch from 'components/collection/PublicSwitch';
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
    const { collection, list } = this.props;
    const bkCount = list.get('bookmarks').size;
    const bookmarks = `${bkCount} Page${bkCount === 1 ? '' : 's'}`;
    const user = collection.get('owner');

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
            key={list.get('id')}
            initial={list.get('desc') || defaultListDesc}
            onSave={this.editDesc}
            success={this.props.listEdited} />
        </Truncate>
        <div className="creator">
          Created by <Link to={`/${user}`}>{user}</Link>, with {bookmarks} from the collection <Link to={getCollectionLink(collection)}>{collection.get('title')}</Link>
        </div>
        <div className="function-row">
          <PublicSwitch
            callback={this.setPublic}
            isPublic={list.get('public')}
            label="List" />
          <Button onClick={this.startReplay} className="rounded">VIEW PAGES</Button>
        </div>
      </div>
    );
  }
}


export default ListHeaderUI;
