import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import removeMd from 'remove-markdown';
import { Button, DropdownButton, MenuItem } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { onboardingLink, truncSentence, truncWord } from 'config';
import { doubleRAF, getCollectionLink, truncate } from 'helpers/utils';

import { DeleteCollection, Upload } from 'containers';

import Capstone from 'components/collection/Capstone';
import PublicSwitch from 'components/collection/PublicSwitch';
import { OnBoarding } from 'components/siteComponents';
import { MoreIcon, PlusIcon } from 'components/icons';

import './style.scss';


class CollectionHeaderUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool,
    isMobile: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    collEdited: PropTypes.bool,
    collEditError: PropTypes.string,
    deleteColl: PropTypes.func,
    history: PropTypes.object,
    editCollection: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      onBoarding: false
    };
  }

  setPublic = (bool) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), { public: bool });
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

  showOnboarding = () => {
    this.setState({ onBoarding: true });
    doubleRAF(() => this.setState({ onBoarding: false }));
  }

  togglePublicView = () => {
    const { collection, history } = this.props;
    history.push(getCollectionLink(collection));
  }

  render() {
    const { canAdmin, isAnon } = this.context;
    const { collection, collEdited } = this.props;
    const { onBoarding } = this.state;

    const containerClasses = classNames('wr-collection-header');

    const isPublic = collection.get('public');

    const collTitle = collection.get('title');
    const titleCapped = truncate(collTitle, 9, truncWord);

    return (
      <header className={containerClasses}>
        {
          onboardingLink && !this.context.isMobile &&
            <OnBoarding open={onBoarding} />
        }
        <div className="overview" key="collOverview">
          <div className={classNames('heading-row', { 'is-public': !canAdmin })}>
            <Capstone user={collection.get('owner')} />
            <h1 title={collection.get('title')}>{titleCapped}</h1>
            {
              collection.get('desc') ?
                <div className="desc">
                  {
                    truncate(removeMd(collection.get('desc'), { useImgAltText: false }), 1, truncSentence)
                  }
                </div> :
                <button className="button-link">+ Add description</button>
            }
          </div>

          {
            canAdmin &&
              <div className="menu-row">
                <Button className="rounded new-session" onClick={this.newSession}><PlusIcon /><span className="hidden-xs"> New Session</span></Button>
                <DropdownButton id="coll-menu" noCaret className="rounded" title={<MoreIcon />}>
                  <MenuItem onClick={this.newSession}>New Session</MenuItem>
                  <MenuItem divider />
                  <MenuItem onClick={this.togglePublicView}>Cover</MenuItem>
                  <MenuItem divider />
                  <MenuItem onClick={this.manageCollection}>Manage Sessions</MenuItem>
                  {
                    !isAnon &&
                      <Upload classes="" fromCollection={collection.get('id')} wrapper={MenuItem}>Upload To Collection</Upload>
                  }
                  <MenuItem onClick={this.downloadCollection}>Download Collection</MenuItem>
                  <DeleteCollection wrapper={MenuItem}>Delete Collection</DeleteCollection>
                  <MenuItem divider />
                  {
                    onboardingLink && !this.context.isMobile &&
                      <MenuItem onClick={this.showOnboarding}>&#127881; Tour New Features</MenuItem>
                  }
                  <MenuItem href="https://webrecorder.github.io/webrecorder-user-guide/" target="_blank">Help</MenuItem>
                </DropdownButton>
              </div>
          }

          <div className="access-row">
            <Link to={getCollectionLink(collection)}>Collection Cover</Link>
            {
              !isAnon &&
                <PublicSwitch
                  callback={this.setPublic}
                  isPublic={isPublic}
                  label="Collection" />
            }
          </div>
        </div>
      </header>
    );
  }
}


export default CollectionHeaderUI;
