import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Alert, Button } from 'react-bootstrap';

import { defaultListDesc } from 'config';

import InlineEditor from 'components/InlineEditor';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon } from 'components/icons';

import './style.scss';


class ListHeaderUI extends PureComponent {
  static contextTypes = {
    asPublic: PropTypes.bool,
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
    editList(collection.get('user'), collection.get('id'), list.get('id'), { title });
  }

  editDesc = (desc) => {
    const { collection, list, editList } = this.props;
    editList(collection.get('user'), collection.get('id'), list.get('id'), { desc });
  }

  startReplay = () => {
    const { collection, history, list } = this.props;
    const first = list.getIn(['bookmarks', 0]);

    if (first) {
      history.push(`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}-${first.get('id')}/${first.get('timestamp')}/${first.get('url')}`);
    }
  }

  viewCollection = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}/pages`);
  }

  render() {
    const { asPublic, canAdmin } = this.context;
    const { collection, list } = this.props;
    const bkCount = list.get('bookmarks').size;
    const bookmarks = `${bkCount} Page${bkCount === 1 ? '' : 's'}`;
    const user = collection.get('user');

    return (
      <div className="wr-list-header">
        {
          asPublic &&
            <Alert bsStyle="warning">
              Viewing collection as a public user. <Button bsSize="xs" onClick={this.togglePublicView}>return to owner view</Button>
            </Alert>
        }
        <span className="banner"><ListIcon /> LIST</span>
        <div className="heading-container">
          <InlineEditor
            initial={list.get('title')}
            onSave={this.editListTitle}
            success={this.props.listEdited}>
            <h1>{list.get('title')}</h1>
          </InlineEditor>
        </div>
        <Truncate height={75}>
          <WYSIWYG
            initial={list.get('desc') || defaultListDesc}
            onSave={this.editDesc}
            success={this.props.listEdited} />
        </Truncate>
        <div className="creator">
          Created by <Link to={`/${user}`}>{user}</Link>, with {bookmarks} from the collection <Link to={`/${user}/${collection.get('id')}`}>{collection.get('title')}</Link>
        </div>
        <div className="function-row">
          <Button onClick={this.startReplay} className="rounded">VIEW PAGES</Button>
          <Button onClick={this.viewCollection} className="rounded">SEE PARENT COLLECTION</Button>
          <Button className="rounded">SHARE</Button>
        </div>
      </div>
    );
  }
}


export default ListHeaderUI;
