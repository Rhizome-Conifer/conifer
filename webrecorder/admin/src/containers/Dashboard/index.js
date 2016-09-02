import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import sum from 'lodash/sum';

import Heading from 'components/Heading';
import RadialGraph from 'components/RadialGraph';
import { loadDashboard } from './actions';

import './style.scss';


class Dashboard extends Component {

  static propTypes = {
    users: PropTypes.array,
    getDashboard: PropTypes.func,
  }

  componentWillMount() {
    this.props.getDashboard();
  }

  render() {
    const { users } = this.props;

    if(!users || users.length === 0)
      return (<div><Heading type={3}>Admin dashboard</Heading><p>no user stats</p></div>);

    const lday = moment().subtract(1, 'days');
    const lweek = moment().subtract(7, 'days');
    const lmonth = moment().subtract(1, 'month');

    const lastLogins = users.map(u => moment(u.last_login));

    /* calculate some stats.. eventually move to server and cache */
    const dayActive = sum(lastLogins.map(l => Number(l > lday)));
    const dayActivePerct = Math.round(dayActive/lastLogins.length * 100);

    const weekActive = sum(lastLogins.map(l => Number(l > lweek)));
    const weekActivePerct = Math.round(weekActive/lastLogins.length * 100);

    const monthActive = sum(lastLogins.map(l => Number(l > lmonth)));
    const monthActivePerct = Math.round(monthActive/lastLogins.length * 100);

    const collections = sum(users.map(u => u.collections.length));

    return (
      <div>
        <Heading type={3}>Admin dashboard</Heading>
        <dl className='wr-overview'>
          <dt>User Count</dt>
          <dd>{users.length}</dd>

          <dt>Public Collections</dt>
          <dd>{collections}</dd>
        </dl>

        <Heading type={4}>Activity</Heading>
        <div className='wr-activity'>
          <RadialGraph
            percentage={dayActivePerct}
            label={`${dayActivePerct}%`}
            legend='Users active in the last 24 hours' />

          <RadialGraph
            percentage={weekActivePerct}
            label={`${weekActivePerct}%`}
            legend='Users active in the last week' />

          <RadialGraph
            percentage={monthActivePerct}
            label={`${monthActivePerct}%`}
            legend='Users active in the last month' />
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const { dashboard } = state;
  return {
    users: dashboard.users,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    getDashboard: () => dispatch(loadDashboard()),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
