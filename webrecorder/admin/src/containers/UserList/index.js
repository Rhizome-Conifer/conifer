import React, { Component, PropTypes } from 'react';
import Helmet from 'react-helmet';
import moment from 'moment';
import { connect } from 'react-redux';

import Heading from 'components/Heading';
import List from 'components/List';
import SizeFormat from 'components/SizeFormat';
import { loadTempUsers, loadUsers } from './actions';


class UserList extends Component {

  static propTypes = {
    loadUsers: PropTypes.func,
    users: PropTypes.arrayOf(PropTypes.object),
  }

  static defaultProps = {
    laoding: true,
  }

  constructor(props) {
    super(props);

    this.state = {};

    /**
     * pass table keys
     */
    this.keys = [
      { id: 'username', ln: u => `/admin/users/${u.username}`, sortable: true },
      { id: 'email', sortable: true },
      { id: 'name', sortable: true, sortFunction: (a,b) => { var _a = a.toLowerCase().split(' '); var _b = b.toLowerCase().split(' '); return _a[_a.length-1].localeCompare(_b[_b.length-1]); }},
      { id: 'role', cl: 'hidden-sm hidden-xs', sortable: true },
      { id: 'space_utilization', label: 'disk utilization', cl: 'hidden-sm hidden-xs', sortable: true, component: item => { const o = item.space_utilization; const p=o.used/o.total*100; return <SizeFormat className={p>75?(p<90?'yellow':'red'):null} bytes={o.used} />}, sortFunction: (a,b) => a.used > b.used ? 1:-1},
      { id: 'created', cl:'hidden-xs', sortable: true, format: o => moment.utc(o).local().format('LLL'), sortFunction: (a,b) => moment(a) < moment(b)? -1:1 },
    ];
    this.tempKeys = [
      { id: 'username', sortable: true },
      { id: 'space_utilization', label: 'disk utilization', cl: 'hidden-sm hidden-xs', sortable: true, component: item => { const o = item.space_utilization; const p=o.used/o.total*100; return <SizeFormat className={p>75?(p<90?'yellow':'red'):null} bytes={o.used} />}, sortFunction: (a,b) => a.used > b.used ? 1:-1},
      { id: 'created', sortable: true, format: o => moment.utc(o).local().format('LLL'), sortFunction: (a,b) => moment(a) < moment(b)? -1:1 },
      { id: 'removal', sortable: true, format: o => moment.utc(o).local().format('LLL'), sortFunction: (a,b) => moment(a) < moment(b)? -1:1 },
    ];
  }

  componentWillMount() {
    if(this.props.route.temp)
      this.props.loadTempUsers();
    else
      this.props.loadUsers();
  }

  componentWillReceiveProps(nextProps) {
    if(nextProps.route !== this.props.route) {
      if(nextProps.route.temp)
        this.props.loadTempUsers();
      else
        this.props.loadUsers();
    }
  }

  render() {
    const { users } = this.props;
    const { sorting } = this.state;

    const isTemp = this.props.route.temp;

    return (
      <div>
        <Helmet
          title={`${isTemp?'Temporary ':''}User List`} />
        <Heading type={3}>{`${isTemp?'Temporary ':''}User List`}</Heading>
        {
          <List
            items={users}
            keys={isTemp?this.tempKeys:this.keys}
            sortBy={sorting}
            uniqueKey='username'
            emptyMsg='0 users'
            filterable={isTemp?['username']:['username','email','name']} />
        }
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  return {
    loadUsers: (qs=null) => dispatch(loadUsers(qs)),
    loadTempUsers: () => dispatch(loadTempUsers()),
  };
}

function mapStateToProps(state) {
  const { users } = state;
  return {
    users: users.users,
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserList);
