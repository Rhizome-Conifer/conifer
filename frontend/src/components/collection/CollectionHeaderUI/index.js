import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, DropdownButton, MenuItem } from 'react-bootstrap';
import { CSSTransitionGroup } from 'react-transition-group';

import { defaultCollDesc } from 'config';
import { doubleRAF, getCollectionLink, stopPropagation } from 'helpers/utils';

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

  setPublic = (bool) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), { public: bool });
  }

  expandHeader = () => {
    if (this.state.condensed) {
      this.setState({ condensed: false, zIndex: 0 });
      this.container.addEventListener('transitionend', () => { this.setState({ height: 'auto', zIndex: 20 }); }, { once: true });
    }
  }

  editModeCallback = () => {
    if (this.state.condensed) {
      this.setState({ height: 'auto', zIndex: 20 });
    }
  }

  editCollTitle = (title) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), { title });
  }

  editDesc = (desc) => {
    const { collection, editCollection } = this.props;
    editCollection(collection.get('owner'), collection.get('id'), { desc });
  }

  newSession = () => {
    const { collection, history } = this.props;
    history.push(`${getCollectionLink(collection)}/$new`);
  }

  manageCollection = () => {
    const { collection, history } = this.props;
    history.push(`${getCollectionLink(collection)}/management`);
  }

  downloadCollection = () => {
    const { collection } = this.props;
    window.location = `${getCollectionLink(collection)}/$download`;
  }

  howTo = () => {
    const { history } = this.props;
    history.push('/_documentation');
  }

  togglePublicView = () => {
    const { collection, history } = this.props;
    history.push(getCollectionLink(collection));
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

    const isPublic = collection.get('public');

    const menu = canAdmin && (
      <div className="utility-row" onClick={stopPropagation}>
        <Button className="rounded" onClick={this.newSession}><PlusIcon /> New Session</Button>
        {
          !isAnon &&
            <PublicSwitch
              callback={this.setPublic}
              isPublic={isPublic}
              label="Collection" />
        }
        {
          !condensed &&
            <Button className="rounded" onClick={this.togglePublicView}>See Public View</Button>
        }
        <DropdownButton pullRight={condensed} id="coll-menu" noCaret className="rounded" title={<MoreIcon />}>
          <MenuItem onClick={this.newSession}>New Session</MenuItem>
          <MenuItem divider />
          <MenuItem onClick={this.togglePublicView}>See Public View</MenuItem>
          <MenuItem divider />
          <MenuItem onClick={this.manageCollection}>Manage Sessions</MenuItem>
          {
            !isAnon &&
              <Upload classes="" fromCollection={collection.get('id')} wrapper={MenuItem}>Upload To Collection</Upload>
          }
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
          transitionEnterTimeout={400}
          transitionLeaveTimeout={400}>
          {
            condensed ?
              <div className="collection-bar" key="collBar">
                <div className="bar-heading">
                  <div className="coll-title">
                    <WarcIcon />
                    <InlineEditor
                      initial={collection.get('title')}
                      onSave={this.editCollTitle}
                      readOnly={isAnon || !canAdmin}
                      success={collEdited}
                      error={this.props.collEditError}>
                      <h1>{collection.get('title')}</h1>
                    </InlineEditor>
                  </div>
                </div>
                {
                  canAdmin && menu
                }
              </div> :
              <div className="overview" key="collOverview">
                <div className={classNames('heading-row', { 'is-public': !canAdmin })}>
                  <Capstone user={collection.get('owner')} />
                  <div className="heading-container">
                    <InlineEditor
                      initial={collection.get('title')}
                      onSave={this.editCollTitle}
                      success={collEdited}
                      error={this.props.collEditError}
                      readOnly={isAnon || !canAdmin}>
                      <h1>{collection.get('title')}</h1>
                    </InlineEditor>
                  </div>
                  {
                    canAdmin && menu
                  }
                </div>
                <Truncate className="desc-container" propPass="clickToEdit" height={100}>
                  <WYSIWYG
                    key={collection.get('id')}
                    initial={collection.get('desc')}
                    onSave={this.editDesc}
                    placeholder={defaultCollDesc}
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
