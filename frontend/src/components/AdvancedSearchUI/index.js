import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import DatePicker from 'react-datepicker';

import { setSort } from 'store/modules/collection';

import TableRenderer from 'components/collection/TableRenderer';

import "react-datepicker/dist/react-datepicker.css";
import './style.scss';


class AdvancedSearchUI extends Component {

  constructor(props) {
    super(props);

    this.state = {
      bodyText: false,
      date: 'anytime',
      endDate: new Date(),
      includeWebpages: false,
      includeImages: false,
      includeAudio: false,
      includeVideo: false,
      includeDocuments: false,
      itemUrl: false,
      search: '',
      session: '',
      startDate: new Date()
    };

    this.labels = {
      anytime: 'Anytime',
      daterange: 'Between specific dates',
      session: 'During a specific capture session'
    };
  }

  changeTimeframe = (evtKey, evt) => {
    this.setState({ date: evtKey });
  }

  handleInput = (evt) => {
    if (evt.target.type === 'checkbox') {
      if (evt.target.name in this.state) {
        this.setState({ [evt.target.name]: !this.state[evt.target.name] });
      } else {
        this.setState({ [evt.target.name]: true });
      }
    } else {
      this.setState({
        [evt.target.name]: evt.target.value
      });
    }
  }

  setEndDate = d => this.setState({ endDate: d })

  setStartDate = d => this.setState({ startDate: d })

  search = () => {
    const { collection } = this.props;
    const {
      date,
      endDate,
      includeAudio,
      includeDocuments,
      includeImages,
      includeVideo,
      includeWebpages,
      search,
      session,
      startDate
    } = this.state;

    const mime = (includeWebpages ? 'text/html,' : '') +
                 (includeImages ? 'image/,' : '') +
                 (includeAudio ? 'audio/,' : '') +
                 (includeVideo ? 'video/,' : '') +
                 (includeDocuments ? 'application/pdf' : '');

    let dateFilter = {};

    if (date === 'daterange') {
      dateFilter = {
        from: startDate.getTime(),
        to: endDate.getTime()
      };
    } else if (date === 'session') {
      dateFilter.session = session;
    }

    const searchParams = {
      search,
      mime,
      ...dateFilter
    };

    this.props.searchCollection(collection.get('owner'), collection.get('id'), searchParams);
  }

  selectSession = (session, evt) => this.setState({ session })

  sort = ({ sortBy, sortDirection }) => {
    const { collection, dispatch } = this.props;
    const prevSort = collection.getIn(['sortBy', 'sort']);
    const prevDir = collection.getIn(['sortBy', 'dir']);

    if (prevSort !== sortBy) {
      dispatch(setSort({ sort: sortBy, dir: sortDirection }));
    } else {
      dispatch(setSort({ sort: sortBy, dir: prevDir === 'ASC' ? 'DESC' : 'ASC' }));
    }
  }

  render() {
    const { browsers, collection, pages } = this.props;
    const { date, session } = this.state;

    return (
      <div className="search-mock">
        <section id="advanced-search">
          <div className="filter">
            <div className="label">Contains the words</div>
            <div className="options">
              <input type="text" name="search" onChange={this.handleInput} />
              {/*
              <div className="sub-filters">
                <div className="label">within</div>
                <ul>
                  <li><label><input type="checkbox" onChange={this.handleInput} name="itemUrl" checked={this.state.itemUrl} /> item url</label></li>
                  <li><label><input type="checkbox" onChange={this.handleInput} name="bodyText" checked={this.state.bodyText} /> body text (if any)</label></li>
                </ul>
              </div>
              */}
            </div>
          </div>

          <div className="filter">
            <div className="label">Include File Types</div>
            <ul>
              <li><label><input type="checkbox" onChange={this.handleInput} name="includeWebpages" checked={this.state.includeWebpages} /> Webpages</label></li>
              <li><label><input type="checkbox" onChange={this.handleInput} name="includeImages" checked={this.state.includeImages} /> Images</label></li>
              <li><label><input type="checkbox" onChange={this.handleInput} name="includeAudio" checked={this.state.includeAudio} /> Audio</label></li>
              <li><label><input type="checkbox" onChange={this.handleInput} name="includeVideo" checked={this.state.includeVideo} /> Video</label></li>
              <li><label><input type="checkbox" onChange={this.handleInput} name="includeDocuments" checked={this.state.includeDocuments} /> Documents (.pdf, .doc, .pptx, etc.)</label></li>
            </ul>
          </div>

          <div className="filter">
            <div className="label">Date Archived</div>
            <div>
              <DropdownButton id="time-filter" title={this.labels[date]} onSelect={this.changeTimeframe}>
                {
                  Object.keys(this.labels).map(k => <MenuItem key={k} eventKey={k} active={date === k}>{this.labels[k]}</MenuItem>)
                }
              </DropdownButton>
              {
                date === 'daterange' &&
                  <div className="date-select">
                    <div className="start-date">
                      <div className="label">From</div>
                      <DatePicker
                        showPopperArrow={false}
                        selected={this.state.startDate}
                        onChange={this.setStartDate} />
                      <DatePicker
                        selected={this.state.startDate}
                        onChange={this.setStartDate}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="h:mm aa" />
                    </div>
                    <div className="end-date">
                      <div className="label">To</div>
                      <DatePicker
                        showPopperArrow={false}
                        selected={this.state.endDate}
                        onChange={this.setEndDate} />
                      <DatePicker
                        selected={this.state.endDate}
                        onChange={this.setEndDate}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="h:mm aa" />
                    </div>
                  </div>
              }
              {
                date === 'session' &&
                  <DropdownButton id="session-filter" title="Select a session" onSelect={this.selectSession}>
                    {
                      collection.get('recordings').map(rec => <MenuItem key={rec.get('id')} eventKey={rec.get('id')} active={session === rec.get('id')}>{rec.get('id')}</MenuItem>)
                    }
                  </DropdownButton>
              }
            </div>
          </div>
          <div className="actions">
            <button type="button" className="button-link">Reset to Defaults</button>
            <button type="button" className="rounded" onClick={this.search}>Search</button>
          </div>
        </section>
        <TableRenderer {...{
          browsers,
          collection,
          displayObjects: pages,
          sort: this.sort
        }} />
      </div>
    );
  }
}


export default AdvancedSearchUI;
