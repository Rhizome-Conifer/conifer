import React, { Component, PropTypes } from 'react';
import Helmet from 'react-helmet';
import sumBy from 'lodash/sumBy';
import moment from 'moment';
import { connect } from 'react-redux';

import Heading from 'components/Heading';
import List from 'components/List';
import ModalForm from 'components/ModalForm';
import ModalFormButton from 'components/ModalFormButton';
import RadialGraph from 'components/RadialGraph';
import SizeFormat from 'components/SizeFormat';
import { loadUser, updateUser } from './actions';

import './style.scss';


class UserDetail extends Component {

  static propTypes = {
    roles: PropTypes.array,
    user: PropTypes.shape({
      email: PropTypes.string,
      name: PropTypes.string,
      created: PropTypes.string,
      loast_login: PropTypes.string,
      role: PropTypes.string,
      // TODO: fill this in
      collections: PropTypes.array,
      space_utilization: PropTypes.shape({
        available: PropTypes.number,
        total: PropTypes.number,
        used: PropTypes.number,
      }),
    }),
  }

  constructor(props) {
    super(props);

    this.state = {
      showModal:false,
      form:null,
    }

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.save = this.save.bind(this);
  }

  open(evt, form=null) {
    if(form)
      this.setState({showModal: true, form: form});
  }

  close() {
    this.setState({showModal: false});
  }

  save(data) {
    this.props.updateUser(this.props.params.username, data);
  }

  componentDidMount() {
    if(typeof this.props.params !== 'undefined')
      this.props.loadUser(this.props.params.username);
  }

  render() {
    const { user, roles } = this.props;
    const { username } = this.props.params;
    const { showModal, form } = this.state;

    // return an empty element if we don't have a user yet
    if(!user) return <div />;

    const spacePerct = Math.round(user.space_utilization.used/user.space_utilization.total * 100);

    /* inline modal forms */
    const editSizeForm = [
      {
        type:'text',
        label: 'Change size',
        field: 'max_size',
        placeholder: user.space_utilization.total/1000000000,
        validate: (v) => !isNaN(v) && v * 1000000000 > user.space_utilization.used,
        help: `A number in gigabytes greater than current utilization: ${user.space_utilization.used/1000000000} GB`,
      },
    ];
    const editRoleForm = [
      {
        type: 'select',
        label: 'Change Role',
        field: 'role',
        value: user.role,
        values: roles,
        placeholder: 'select',
        validate: (v) => true,
        help: 'Select `archivist` for a standard user or `admin` for superuser (admin panel) access',
      },
    ];
    const makeCollectionPrivate = [
      {
        type:'readOnly',
        label: 'Make collection private?',
        field: 'set_private',
        value:'',
        validate: (v) => true,
        help: 'This will set the selected collection private and send an email to the user notifying them. Use this to start a conversation on a DMCA take-down request or for other instances of inappropriate material.',
      },
    ];

    const collectionKeys = [
      {id: 'title', sortable: true, ln: o => `/${username}/${o.id}`},
      {id: 'size', cl: 'hidden-xs', sortable: true, format: (s) => `${(s/1000000).toFixed(1)} MB`},
      {id: 'recordings', cl: 'hidden-xs', sortable: true, 'label': 'recordings', format: (r) => r.length},
      {id: 'recordings', cl: 'hidden-xs', sortable: true, 'label': 'bookmarks', format: (r) => (r.length ? sumBy(r, (o) => o.pages.length):0)},
      {id: 'make_private', 'label': 'admin', component: o => <ModalFormButton key={o.id} bsSize='xsmall' form={[Object.assign({}, makeCollectionPrivate[0], {value: o.id}),]} onClick={this.open}>make private</ModalFormButton>},
    ];

    return (
      <div>
        <Helmet title={`${username} Info`} />
        {
          user &&
            <div>
              <Heading type={3}>{ username }</Heading>
              <section id='info-container'>
                <div id='info'>
                  <Heading type={4}>Info</Heading>
                  <dl>
                    <dt>email</dt>
                    <dd>{user.email}</dd>

                    <dt>username</dt>
                    <dd>{username}</dd>

                    <dt>name</dt>
                    <dd>{user.name}</dd>

                    <dt>role</dt>
                    <dd>
                      {user.role}
                      <ModalFormButton
                        bsSize='xsmall'
                        form={editRoleForm}
                        onClick={this.open}>
                          change
                      </ModalFormButton>
                    </dd>

                    <dt>created at</dt>
                    <dd>{moment.utc(user.created).local().format('LLL')}</dd>

                    <dt>last login</dt>
                    <dd>{moment.utc(user.last_login).local().format('LLL')}</dd>
                  </dl>
                </div>

                <div id='collections'>
                  <Heading type={4}>Disk Usage</Heading>
                  <div className='wr-usage'>
                    <RadialGraph
                      percentage={spacePerct}
                      label={`${spacePerct<1?'< 1':spacePerct}%`}
                      showWarning={true}
                      className='hidden-xs' />

                    <dl className='readout'>
                      <dt>Total size</dt>
                      <dd>
                        <SizeFormat bytes={user.space_utilization.total} />
                        <ModalFormButton
                          bsSize='xsmall'
                          form={editSizeForm}
                          onClick={this.open}>
                            increase
                        </ModalFormButton>
                      </dd>

                      <dt>Used</dt>
                      <dd><SizeFormat bytes={user.space_utilization.used} /></dd>

                      <dt>Available</dt>
                      <dd><SizeFormat bytes={user.space_utilization.available} /></dd>
                    </dl>
                  </div>

                  <Heading type={4}>Public Collections</Heading>
                  <List
                    emptyMsg={'0 public collections'}
                    items={user.collections}
                    keys={collectionKeys}
                    uniqueKey='title' />
                </div>
              </section>
            </div>
        }
        <ModalForm
          show={showModal}
          close={this.close}
          save={this.save}
          form={form}
          title='User Management' />
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  return {
    loadUser: (username) => dispatch(loadUser(username)),
    updateUser: (username, data) => dispatch(updateUser(username, data)),
  };
}

function mapStateToProps(state) {
  const { user } = state;
  return {
    user: user.user,
    roles: user.roles,
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserDetail);
