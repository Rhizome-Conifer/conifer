import React, { Component, PropTypes } from 'react';
import Helmet from 'react-helmet';
import { connect } from 'react-redux';

import Heading from 'components/Heading';
import List from 'components/List';
import SizeFormat from 'components/SizeFormat';
import { loadUsers } from './actions';


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
    this.filterClick = this.filterClick.bind(this);
  }

  componentWillMount() {
    this.props.loadUsers();
  }

  filterClick(evt) {
  }

  render() {
    const { users } = this.props;
    const { sorting } = this.state;

    /**
     * pass table keys
     */
    const keys = [
      { id: 'username', ln: u => `/admin/users/${u.username}`, sortable: true },
      { id: 'email', sortable: true },
      { id: 'name', sortable: true },
      { id: 'role', cl: 'hidden-sm hidden-xs', sortable: true },
      { id: 'space_utilization', label: 'disk utilization', cl: 'hidden-sm hidden-xs', sortable: true, component: item => { const o = item.space_utilization; const p=o.used/o.total*100; return <SizeFormat className={p>75?(p<90?'yellow':'red'):null} bytes={o.used} />}, sortFunction: (a,b) => a.used > b.used ? 1:-1},
      { id: 'created', cl:'hidden-xs', sortable: true },
    ];

    return (
      <div>
        <Helmet
          title='User List' />
        <Heading type={3}>User List</Heading>
        {
          <List
            items={users}
            keys={keys}
            filterFn={this.filterClick}
            sortBy={sorting}
            uniqueKey='username' />
        }
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  return {
    loadUsers: (qs=null) => dispatch(loadUsers(qs)),
  };
}

function mapStateToProps(state) {
  const { users } = state;
  return {
    users: users.users,
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserList);
