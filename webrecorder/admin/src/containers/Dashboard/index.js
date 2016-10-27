import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer,
         Legend, Tooltip, XAxis, YAxis } from 'recharts';
import moment from 'moment';

import find from 'lodash/find';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import sum from 'lodash/sum';

import { Grid, Col } from 'react-bootstrap';

import Heading from 'components/Heading';
import List from 'components/List';
import RadialGraph from 'components/RadialGraph';
import { loadDashboard } from './actions';
import { bytesToMb } from 'components/SizeFormat';

import './style.scss';


function CustomizedAxisTick(props) {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} fontSize={12} textAnchor="end" fill="#666" transform="rotate(-35)">{payload.value}</text>
    </g>
  );
}

function CustomizedLabel(props) {
  const { x, y, stroke, payload } = props;
  const v = payload.value[1];
  return <text x={x} y={y} dy={-10} fill={stroke} fontSize={15} textAnchor="middle">{`${v < 0.01 ? '< 1':v.toFixed(2)} MB`}</text>
}


class Dashboard extends Component {

  static propTypes = {
    users: PropTypes.array,
    getDashboard: PropTypes.func,
  }

  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);


    this.collectionKeys = [
      {id: 'title', sortable: true},
      {id: 'created_at', label: 'created at', sortable: true, format: (d) => moment.unix(d).local().format('L LT')},
      {id: 'size', sortable: true, format: (s) => `${(s/1000000).toFixed(1)} MB`},
    ];

    this.state = {
      dateRange: 7,
      usageData: [],
      dayActivePerct: 0,
      weekActivePerct: 0,
      monthActivePerct: 0,
    };
  }

  componentWillMount() {
    this.props.getDashboard();
  }

  componentWillReceiveProps(nextProps) {
    /**
     * Do some heavy-ish processing here on prop change
     */

    // combine temp and user usage into one array
    const usageData = map(nextProps.tempUsage, o => ({'date': o[0], 'temp': bytesToMb(o[1]), 'user':0}));
    forEach(nextProps.userUsage, item => {
      const m = find(usageData, o => o.date === item[0]);
      const v = bytesToMb(item[1]);
      if(typeof m !== 'undefined')
        m['user'] = v;
      else
        usageData.splice(1, 0, {'date':item[0], 'temp':0, 'user': v});
    });

    const users = nextProps.users;
    const lday = moment().subtract(1, 'days');
    const lweek = moment().subtract(7, 'days');
    const lmonth = moment().subtract(1, 'month');

    const lastLogins = users.map(u => moment(u.last_login));

    /* calculate some stats.. */
    const dayActive = sum(lastLogins.map(l => Number(l > lday)));
    const dayActivePerct = Math.round(dayActive/lastLogins.length * 100);

    const weekActive = sum(lastLogins.map(l => Number(l > lweek)));
    const weekActivePerct = Math.round(weekActive/lastLogins.length * 100);

    const monthActive = sum(lastLogins.map(l => Number(l > lmonth)));
    const monthActivePerct = Math.round(monthActive/lastLogins.length * 100);

    this.setState({
      usageData,
      dayActivePerct,
      weekActivePerct,
      monthActivePerct,
    });
  }

  handleChange(evt) {
    this.setState({dateRange: parseInt(evt.target.value, 10)});
  }

  render() {
    const { dateRange, dayActivePerct, monthActivePerct,
            usageData, weekActivePerct } = this.state;
    const { users, collections } = this.props;

    if(!users || users.length === 0)
      return (<div><Heading type={3}>Admin dashboard</Heading><p>no user stats</p></div>);

    return (
      <div>
        <Heading type={3}>Admin dashboard</Heading>
        <dl className='wr-overview'>
          <dt>User Count</dt>
          <dd>{users.length}</dd>

          <dt>Public Collections</dt>
          <dd>{collections.length}</dd>
        </dl>

        <Grid className='wr-charts' fluid={true}>
          <Col md={6} className='wr-activity'>
            <Heading type={4}>Activity</Heading>
            <div className='wr-activity-charts'>
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
          </Col>
          <Col md={6} className='wr-collections'>
            <Heading type={4}>Collections</Heading>
            <List
              emptyMsg={'0 public collections'}
              items={collections}
              keys={this.collectionKeys}
              uniqueKey='title'
              perPage={5}
              defaultSort={{column: 'created at', direction: 'desc'}} />
          </Col>
        </Grid>

        <div className='wr-usage'>
          <Heading type={4}>Usage</Heading>
          <select
            className='wr-dateRange'
            onChange={this.handleChange}
            defaultValue='7'>
              <option value='1'>Today</option>
              <option value='3'>3 days</option>
              <option value='7'>Week</option>
              <option value='30'>Month</option>
              <option value='365'>Year</option>
              <option value='0'>All</option>
          </select>
          <ResponsiveContainer>
            <AreaChart
              data={usageData.slice(-dateRange)}
              margin={{ top: 10, right: 40, bottom: 50, left: 0 }}>

              <XAxis stroke='#727078' dataKey='date' tick={<CustomizedAxisTick />} />
              <YAxis stroke='#9F9DA5' label='MB' />

              <CartesianGrid stroke='#E0DDE4'/>
              { dateRange !== 1 &&
                <Tooltip formatter={ o => o.toFixed(2) } />
              }
              <Legend verticalAlign="top" height={36} />
              <Area type='monotone' label={dateRange===1 && <CustomizedLabel />} dot={dateRange===1} stackId="1" unit=' MB' dataKey='temp' stroke='#D1C453' fill='#EBEE63' />
              <Area type='monotone' label={dateRange===1 && <CustomizedLabel />} dot={dateRange===1} stackId="1" unit=' MB' dataKey='user' stroke='#71AB4B' fill='#B2DF97' />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const { dashboard } = state;
  return {
    users: dashboard.users,
    collections: dashboard.collections,
    tempUsage: dashboard.tempUsage,
    userUsage: dashboard.userUsage,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    getDashboard: () => dispatch(loadDashboard()),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
