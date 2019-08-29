import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import removeMd from 'remove-markdown';
import { Button, DropdownButton, FormControl, MenuItem } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { appHost, onboardingLink, truncSentence, truncWord } from 'config';
import { doubleRAF, getCollectionLink, truncate } from 'helpers/utils';

import { DeleteCollection, Upload } from 'containers';
import Modal from 'components/Modal';
import Capstone from 'components/collection/Capstone';
import EditModal from 'components/collection/EditModal';
import PublicSwitch from 'components/collection/PublicSwitch';
import { OnBoarding } from 'components/siteComponents';
import { ClipboardIcon, DatIcon, LoaderIcon, MoreIcon, PlusIcon } from 'components/icons';

import './style.scss';


class CollectionHeaderUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool,
    isMobile: PropTypes.bool
  };

  static propTypes = {
    auth: PropTypes.object,
    autoId: PropTypes.string,
    collection: PropTypes.object,
    collEdited: PropTypes.bool,
    collEditing: PropTypes.bool,
    collEditError: PropTypes.string,
    deleteColl: PropTypes.func,
    editCollection: PropTypes.func,
    history: PropTypes.object,
    shareToDat: PropTypes.func,
    stopAutomation: PropTypes.func,
    unshareFromDat: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      datShare: false,
      editModal: false,
      onBoarding: false
    };
  }

  downloadCollection = () => {
    const { collection } = this.props;
    window.location.href = `${appHost}/${getCollectionLink(collection)}/$download`;
  }

  copyDat = () => {
    this.datInput.select();
    document.execCommand('copy');
  }

  datHighlight = () => {
    const { collection } = this.props;
    if (collection.get('dat_share') && this.datInput) {
      // add 6 chars for dat:// prefix
      this.datInput.setSelectionRange(0, collection.get('dat_key').length + 6);
    }
  }

  datShare = () => {
    const { collection, shareToDat } = this.props;
    shareToDat(collection.get('owner'), collection.get('id'));
  }

  datUnshare = () => {
    const { collection, unshareFromDat } = this.props;
    unshareFromDat(collection.get('owner'), collection.get('id'));
  }

  editModal = () => {
    this.setState({ editModal: !this.state.editModal });
  }

  editCollection = (data) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), data);
  }

  manageCollection = () => {
    const { collection, history } = this.props;
    history.push(`${getCollectionLink(collection)}/management`);
  }

  newSession = () => {
    const { collection, history } = this.props;
    history.push(`${getCollectionLink(collection)}/$new`);
  }

  setPublic = (bool) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), { public: bool });
  }

  toggleDatModal = () => {
    this.setState({ datShare: !this.state.datShare });
  }

  showOnboarding = () => {
    this.setState({ onBoarding: true });
    doubleRAF(() => this.setState({ onBoarding: false }));
  }

  stopAutomation = () => {
    const { autoId, collection } = this.props;
    this.props.stopAutomation(collection.get('owner'), collection.get('id'), autoId);
  }

  togglePublicView = () => {
    const { collection, history } = this.props;
    history.push(getCollectionLink(collection));
  }

  render() {
    const { canAdmin, isAnon } = this.context;
    const { collection } = this.props;
    const { onBoarding } = this.state;

    const containerClasses = classNames('wr-collection-header');
    const isPublic = collection.get('public');
    const collTitle = collection.get('title');

    const titleCapped = truncate(collTitle, 9, truncWord);
    const allowDat = JSON.parse(process.env.ALLOW_DAT);

    const newFeatures = canAdmin && ['admin', 'beta-archivist'].includes(this.props.auth.get('role'));

    return (
      <header className={containerClasses}>
        {
          onboardingLink && !this.context.isMobile &&
            <OnBoarding open={onBoarding} />
        }
        {
          canAdmin &&
            <EditModal
              closeCb={this.editModal}
              desc={collection.get('desc')}
              editing={this.props.collEditing}
              edited={this.props.collEdited}
              editCallback={this.editCollection}
              error={this.props.collEditError}
              key={collection.get('id')}
              label="Collection"
              name={collection.get('title')}
              open={this.state.editModal}
              readOnlyName={this.context.isAnon} />
        }
        <div className="overview" key="collOverview">
          <div className={classNames('heading-row', { 'is-public': !canAdmin })}>
            <Capstone user={collection.get('owner')} />
            <h1
              className={classNames({ 'click-highlight': canAdmin })}
              onClick={canAdmin ? this.editModal : undefined}
              role={canAdmin ? 'button' : 'presentation'}
              title={collection.get('title')}>
              {titleCapped}
            </h1>
            {
              collection.get('desc') ?
                <div className={classNames('desc', { 'click-highlight': canAdmin })} role={canAdmin ? 'button' : 'resentation'} onClick={canAdmin ? this.editModal : undefined}>
                  {
                    truncate(removeMd(collection.get('desc'), { useImgAltText: false }), 3, truncSentence)
                  }
                </div> :
                canAdmin && <button className="button-link" onClick={this.editModal} type="button">+ Add description</button>
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
                      <Upload classes="" fromCollection={collection.get('id')} wrapper={MenuItem}>{ __DESKTOP__ ? 'Import' : 'Upload' } To Collection</Upload>
                  }
                  <MenuItem onClick={this.downloadCollection}>{ __DESKTOP__ ? 'Export' : 'Download' } Collection</MenuItem>
                  <DeleteCollection wrapper={MenuItem}>Delete Collection</DeleteCollection>
                  {
                    allowDat && canAdmin && !isAnon && newFeatures &&
                      <React.Fragment>
                        <MenuItem divider />
                        <MenuItem onClick={this.toggleDatModal}><p className="menu-label">More Sharing Options</p><DatIcon /> Share via Dat...</MenuItem>
                      </React.Fragment>
                  }
                  <MenuItem divider />
                  {
                    onboardingLink && !this.context.isMobile &&
                      <MenuItem onClick={this.showOnboarding}><span role="img" aria-label="tada emoji">&#127881;</span> Tour New Features</MenuItem>
                  }
                  <MenuItem href="https://guide.webrecorder.io/" target="_blank">Help</MenuItem>
                </DropdownButton>
              </div>
          }
          {
            allowDat &&
            <Modal
              visible={this.state.datShare}
              closeCb={this.toggleDatModal}
              dialogClassName="table-header-modal dat-modal">
              {
                collection.get('dat_share') ?
                  <React.Fragment>
                    <h4>Seeding as Dat Archive</h4>
                    <div className="dat-info">
                      <FormControl readOnly onFocus={this.datHighlight} inputRef={(ref) => { this.datInput = ref; }} type="text" name="datUrl" value={`dat://${collection.get('dat_key')}`} />
                      <Button onClick={this.copyDat} className="rounded copy-dat"><ClipboardIcon />Copy</Button>
                      {
                        collection.get('dat_updated_at') && new Date(collection.get('updated_at')) > new Date(collection.get('dat_updated_at')) ?
                          <div><div className="dat-current update-dat">Dat file is not up-to-date with collection.</div><Button className="rounded" onClick={this.datShare} bsStyle="success">Update</Button></div> :
                          <div className="dat-current">Dat dataset is up-to-date with collection.</div>

                      }
                    </div>
                    <Button className="rectangular" bsStyle="warning" onClick={this.datUnshare}>Stop Sharing</Button>
                  </React.Fragment> :
                  <React.Fragment>
                    <h4>Make Available as a Dat archive</h4>
                    <p>This beta feature converts your collection into a Dat dataset and makes it available on the Dat network.<br /> <br />New to Dat? <a href="https://datproject.org/" target="_blank">Learn more</a></p>

                    {
                      collection.get('datProcessing') && !collection.get('dat_share') ?
                        <div className="loading-dat">
                          <h4><LoaderIcon />Sharing to Dat...</h4>
                          <div className="dat-note">This may take a minute, depending on the size of your collection.</div>
                        </div> :
                        <React.Fragment>
                          <Button className="rectangular" bsStyle="success" onClick={this.datShare}> Make this Collection Available via Dat </Button>
                        </React.Fragment>
                    }
                  </React.Fragment>
              }
              <Button onClick={this.toggleDatModal} className="rectangular">Close</Button>
            </Modal>
          }

          <div className="access-row">
            <Link to={getCollectionLink(collection)}>Collection Cover</Link>
            {
              !isAnon && canAdmin && !__DESKTOP__ &&
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
