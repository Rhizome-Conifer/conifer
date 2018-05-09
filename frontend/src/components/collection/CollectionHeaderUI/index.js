import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { Alert, Button, DropdownButton, MenuItem } from 'react-bootstrap';
import { CSSTransitionGroup } from 'react-transition-group';

import { defaultCollDesc } from 'config';
import { doubleRAF, stopPropagation } from 'helpers/utils';

import { DeleteCollection, Upload } from 'containers';

import Capstone from 'components/collection/Capstone';
import InlineEditor from 'components/InlineEditor';
import PublicSwitch from 'components/collection/PublicSwitch';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { MoreIcon, PlusIcon, WarcIcon } from 'components/icons';

import './style.scss';


class CollectionHeaderUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    collEdited: PropTypes.bool,
    collEditError: PropTypes.string,
    condensed: PropTypes.bool,
    deleteColl: PropTypes.func,
    history: PropTypes.object,
    editCollection: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      animated: false,
      condensed: false,
      height: 'auto',
      zIndex: 20
    };
  }

  componentDidUpdate(prevProps, prevState) {
    const { condensed } = this.props;

    if (condensed && !prevProps.condensed) {
      const height = this.container.getBoundingClientRect().height;
      this.setState({ height });
      doubleRAF(() => this.setState({ condensed: true }));
    } else if (!condensed && prevProps.condensed) {
      this.expandHeader();
    }
  }

  setPublic = () => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('user'), collection.get('id'), { public: !collection.get('public') });
  }

  expandHeader = () => {
    this.setState({ condensed: false, zIndex: 0 });
    this.container.addEventListener('transitionend', () => { this.setState({ height: 'auto', zIndex: 20 }); }, { once: true });
  }

  editModeCallback = () => {
    if (this.state.condensed) {
      this.setState({ height: 'auto', zIndex: 20 });
    }
  }

  editCollTitle = (title) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('user'), collection.get('id'), { title });
  }

  editDesc = (desc) => {
    const { collection, editCollection } = this.props;
    editCollection(collection.get('user'), collection.get('id'), { desc });
  }

  newCapture = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}/$new`);
  }

  manageCollection = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}/management`);
  }

  downloadCollection = () => {
    const { collection } = this.props;
    window.location = `/${collection.get('user')}/${collection.get('id')}/$download`;
  }

  howTo = () => {
    const { history } = this.props;
    history.push('/_documentation');
  }

  togglePublicView = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}`);
    // const { location: { pathname, search }} = this.props;
    // const asPublic = search && search.indexOf('asPublic') !== -1;
    // if (asPublic) {
    //   window.location = `${pathname}${search.replace(/(\?|\&)asPublic/, '')}`;
    // } else {
    //   window.location = `${pathname}${search}${search.indexOf('?') !== -1 ? '&' : '?'}asPublic`;
    // }
  }

  render() {
    const { canAdmin, isAnon } = this.context;
    const { collection, collEdited } = this.props;
    const { condensed, height, zIndex } = this.state;

    const containerClasses = classNames('wr-collection-header', {
      condensed
    });

    const publicLists = collection.get('lists').reduce((sum, l) => (l.get('public') | 0) + sum, 0);
    const isPublic = collection.get('public');

    const menu = (
      <div className="utility-row" onClick={stopPropagation}>
        <Button className="rounded" onClick={this.newCapture}><PlusIcon /> New Capture</Button>
        <Button className="rounded" onClick={this.togglePublicView}>See Public View</Button>
        <DropdownButton pullRight={condensed} id="coll-menu" noCaret className="rounded" title={<MoreIcon />}>
          <MenuItem onClick={this.newCapture}>New Capture</MenuItem>
          <MenuItem divider />
          <MenuItem onClick={this.togglePublicView}>See Public View</MenuItem>
          <MenuItem divider />
          <MenuItem onClick={this.manageCollection}>Manage Collection Contents</MenuItem>
          <Upload classes="" fromCollection={collection.get('id')} wrapper={MenuItem}>Upload To Collection</Upload>
          <MenuItem onClick={this.downloadCollection}>Download Collection</MenuItem>
          <DeleteCollection wrapper={MenuItem}>Delete Collection</DeleteCollection>
          {/* TODO:
          <MenuItem divider />
          <MenuItem>Edit Collection Info</MenuItem>
          */}
          <MenuItem divider />
          <MenuItem onClick={this.howTo}>Help</MenuItem>
        </DropdownButton>
      </div>
    );

    return (
      <header
        className={containerClasses}
        ref={(obj) => { this.container = obj; }}
        style={{ height, zIndex }}
        onClick={this.expandHeader}>
        <CSSTransitionGroup
          component="div"
          transitionName="condense"
          transitionEnterTimeout={300}
          transitionLeaveTimeout={300}>
          {
            condensed ?
              <div className="collection-bar" key="collBar">
                <div className="bar-heading">
                  <div className="coll-title">
                    <WarcIcon />
                    <InlineEditor
                      initial={collection.get('title')}
                      onSave={this.editCollTitle}
                      success={collEdited}
                      error={this.props.collEditError}>
                      <h1>{collection.get('title')}</h1>
                    </InlineEditor>
                  </div>
                  {
                    canAdmin &&
                      <div className="coll-status">
                        <PublicSwitch isPublic={isPublic} callback={this.setPublic} />
                        <span className="public-lists">{`${publicLists} Published List${publicLists === 1 ? '' : 's'}`}</span>
                      </div>
                  }
                </div>
                {
                  menu
                }
              </div> :
              <div className="overview" key="collOverview">
                <div className={classNames('heading-row', { 'is-public': !canAdmin })}>
                  <Capstone user={collection.get('user')} />
                  <div className="heading-container">
                    {
                      canAdmin &&
                        <div className="coll-status">
                          <PublicSwitch isPublic={isPublic} callback={this.setPublic} />
                          <span className="public-lists">{`${publicLists} Published List${publicLists === 1 ? '' : 's'}`}</span>
                        </div>
                    }
                    <InlineEditor
                      initial={collection.get('title')}
                      onSave={this.editCollTitle}
                      success={collEdited}
                      error={this.props.collEditError}>
                      <h1>{collection.get('title')}</h1>
                    </InlineEditor>
                  </div>
                  {
                    canAdmin && menu
                  }
                </div>
                <Truncate className="desc-container" height={100}>
                  <WYSIWYG
                    initial={collection.get('desc') || defaultCollDesc}
                    onSave={this.editDesc}
                    toggleCallback={this.editModeCallback}
                    success={collEdited} />
                </Truncate>
              </div>
          }
        </CSSTransitionGroup>
      </header>
    );
  }
}


export default CollectionHeaderUI;
