import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import DatePicker from 'react-datepicker';
import querystring from 'querystring';
import OutsideClick from 'components/OutsideClick';
import { Button, DropdownButton, FormControl, InputGroup, MenuItem } from 'react-bootstrap';

import { columns } from 'config';

import { LoaderIcon, SearchIcon, XIcon } from 'components/icons';

import "react-datepicker/dist/react-datepicker.css";
import './style.scss';


class Searchbox extends PureComponent {
  static propTypes = {
    collection: PropTypes.object,
    clear: PropTypes.func,
    location: PropTypes.object,
    search: PropTypes.func,
    searching: PropTypes.bool,
    searched: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    let includeWebpages = true;
    let includeImages = false;
    let includeAudio = false;
    let includeVideo = false;
    let includeDocuments = false;
    let session = '';
    let search = '';
    let serachFrag = '';
    let date = 'anytime';
    let startDate = new Date();
    let endDate = new Date();

    this.initialValues = {
      date,
      endDate,
      includeWebpages,
      includeImages,
      includeAudio,
      includeVideo,
      includeDocuments,
      search,
      serachFrag,
      session,
      startDate
    };

    if (props.location.search) {
      const qs = querystring.parse(props.location.search.replace(/^\?/, ''));

      if (qs.search) {
        props.search(qs);
        search = qs.search;
        serachFrag = qs.search;
      }

      if (qs.mime) {
        includeWebpages = qs.mime.includes('text/html');
        includeImages = qs.mime.includes('image/');
        includeAudio = qs.mime.includes('audio/');
        includeVideo = qs.mime.includes('video/');
        includeDocuments = qs.mime.includes('application/pdf');
      }

      if (qs.session) {
        session = qs.session;
        date = 'session';
      }

      if (qs.from || qs.to) {
        startDate = qs.from ? new Date(parseInt(qs.from, 10)) : startDate;
        endDate = qs.to ? new Date(parseInt(qs.to, 10)) : endDate;
        date = 'daterange';
      }
    }

    this.state = {
      date,
      endDate,
      options: false,
      includeWebpages,
      includeImages,
      includeAudio,
      includeVideo,
      includeDocuments,
      search,
      searchStruct: '',
      session,
      startDate
    };

    this.buildQuery(true);

    this.labels = {
      anytime: 'Anytime',
      daterange: 'Between specific dates',
      session: 'During a specific capture session'
    };
  }

  componentDidUpdate(prevProps, prevState) {
    // check for searched prop being cleared
    if (prevProps.searched && !this.props.searched) {
      this.setState({ search: '' });
    }

    if (this.state.options) {
      this.buildQuery(false, this.state.search !== prevState.search);
    }
  }

  buildQuery = (init = false, textChange = false) => {
    const filterValues = {
      includeWebpages: this.state.includeWebpages,
      includeImages: this.state.includeImages,
      includeAudio: this.state.includeAudio,
      includeVideo: this.state.includeVideo,
      includeDocuments: this.state.includeDocuments,
    };
    const filterFields = {
      includeWebpages: 'is:Page',
      includeImages: 'is:Image',
      includeAudio: 'is:Audio',
      includeVideo: 'is:Video',
      includeDocuments: 'is:Document',
    };

    let { date, options, searchFrag } = this.state;
    let { filters, query } = this.parseQuery();

    if (options && query !== searchFrag) {
      query = searchFrag;
    }

    let searchStruct = '';
    Object.keys(filterValues).forEach((val) => {
      const b = textChange ?
        (
          (this.state[val] && filters.includes(filterFields[val])) ||
          (!this.state[val] && filters.includes(filterFields[val]))
        ) : this.state[val];

      // if new typed flag detected, remove flag from query
      if (!this.state[val] && filters.includes(filterFields[val])) {
        console.log('found flag', filterFields[val], 'removing from', query);
        query = query.replace(filterFields[val], '');
      }

      filterValues[val] = b;
      searchStruct += b ? `${filterFields[val]} ` : '';
    });


    // check for date filter changes
    if (textChange && filters.findIndex(f => f.match(/(start|end|session):/)) !== -1 && date === 'anytime') {
      if (filters.findIndex(f => f.match(/(start|end):/)) !== -1) {
        date = 'daterange';
      } else {
        date = 'session';
      }
    } else if(textChange && filters.findIndex(f => f.match(/(start|end|session):/)) === -1 && date !== 'anytime') {
      date = 'anytime';
    }

    if (date === 'daterange') {
      let { startDate, endDate } = this.state;

      if (textChange) {
        const startStr = filters.find(f => f.match(/^start/i)) || '';
        const newStartDate = startStr.match(/(?:start|end):([a-z0-9-.:]+)/i);
        const endStr = filters.find(f => f.match(/^end/i)) || '';
        const newEndDate = endStr.match(/(?:start|end):([a-z0-9-.:]+)/i);

        if (newStartDate && this.dateIsValid(new Date(newStartDate[1])) && newStartDate[1] !== this.dateFormat(this.state.startDate)) {
          startDate = new Date(newStartDate[1]);
          filterValues.startDate = startDate;
        }

        if (newEndDate && this.dateIsValid(new Date(newEndDate[1])) && newEndDate[1] !== this.dateFormat(this.state.endDate)) {
          endDate = new Date(newEndDate[1]);
          filterValues.endDate = endDate;
        }
      }

      searchStruct += `start:${this.dateFormat(startDate)} end:${this.dateFormat(endDate)} `;
    } else if (date === 'session') {
      const sessionFilter = filters.find(f => f.match(/^session/i)) || '';
      let sessionReg = sessionFilter.match(/session:(\w+)/i);
      let session = this.state.session;

      if (textChange && sessionReg && sessionReg[1] !== session) {
        session = sessionReg[1];
        filterValues.session = session;
      }

      if (session) {
        searchStruct += `session:${session} `;
      }
    }

    searchStruct += query;

    console.log(textChange, filters, query, filterValues, searchStruct);

    if (init) {
      this.state.search = searchStruct;
    } else {
      this.setState({
        date,
        ...filterValues,
        search: searchStruct
      });
    }
  }

  dateIsValid = (dt) => {
    return dt instanceof Date && !isNaN(dt);
  }

  dateFormat = (dt) => {
    const s = num => String(num);
    return `${dt.getUTCFullYear()}-${s(dt.getUTCMonth()).padStart(2, '0')}-${s(dt.getUTCDay()).padStart(2, '0')}T${s(dt.getUTCHours()).padStart(2, '0')}:${s(dt.getUTCMinutes()).padStart(2, '0')}`;
  }

  parseQuery = () => {
    const { search } = this.state;
    const filters = search.match(/((is|start|end|session):[a-z0-9-.:]+)/ig) || [];
    const searchRX = search.match(/(?:(?:(?:is|start|end|session):[a-z0-9-.:]+\s?)+\s)?(.*)/i);
    const query = searchRX ? searchRX[1] : '';
    return { filters, query };
  }

  changeTimeframe = (evtKey, evt) => {
    this.setState({ date: evtKey });
  }

  keyUp = (evt) => {
    if (evt.keyCode === 13) {
      this.search();
    }
  }

  handleChange = (evt) => {
    // noop while indexing
    if (this.props.searching) {
      return;
    }

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

  clear = (evt) => {
    const { collection } = this.props;
    evt.stopPropagation();

    window.history.replaceState({}, '', '?search=');
    this.setState({ search: 'is:Page', searchFrag: '' });
    this.props.clear(collection.get('owner'), collection.get('id'));
  }

  reset = () => {
    this.setState({ ...this.initialValues });
  }

  search = () => {
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

    const { query } = this.parseQuery();

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
      search: query,
      mime,
      ...dateFilter
    };

    window.history.replaceState({}, '', `?${querystring.stringify(searchParams)}`);
    this.props.search(searchParams);
    // close adv search
    if (this.state.options) {
      this.setState({ options: false });
    }
  }

  selectSession = session => this.setState({ session })

  setEndDate = d => this.setState({ endDate: d })

  setStartDate = d => this.setState({ startDate: d })

  toggleAdvancedSearch = () => {
    if (!this.state.options) {
      this.buildQuery(false, true);
    }

    const { query } = this.parseQuery();
    this.setState({ options: !this.state.options, searchFrag: query });
  }

  render() {
    const { collection, searching, searched } = this.props;
    const { date } = this.state;

    return (
      <div className="search-box">
        <InputGroup bsClass="input-group search-box" title="Search">
          <div className="input-wrapper">
            <span className="search-icon"><SearchIcon /></span>
            <FormControl aria-label="filter" bsSize="sm" onKeyUp={this.keyUp} onChange={this.handleChange} name="search" value={this.state.search} autoComplete="off" placeholder="Filter" />
            <div className="searchbar-actions">
              {
                (searching || searched) &&
                <React.Fragment>
                  {
                    searching ?
                      <LoaderIcon /> :
                      <button className="borderless" onClick={this.clear} type="button"><XIcon /></button>
                  }
                </React.Fragment>
              }
              <button className="borderless advanced-options" onClick={this.toggleAdvancedSearch} type="button"><span className="glyphicon glyphicon-triangle-bottom" /></button>
            </div>
          </div>
        </InputGroup>

        {
          this.state.options &&
            <OutsideClick handleClick={this.toggleAdvancedSearch}>
              <section className="adv-search-filters">
                <div className="label">Contains the words</div>
                <div className="options">
                  <input type="text" name="searchFrag" value={this.state.searchFrag} onChange={this.handleChange} />
                </div>
                <div className="label">Include File Types</div>
                <ul>
                  <li><label htmlFor="includeWebpages"><input type="checkbox" onChange={this.handleChange} id="includeWebpages" name="includeWebpages" checked={this.state.includeWebpages} /> Webpages</label></li>
                  <li><label htmlFor="includeImages"><input type="checkbox" onChange={this.handleChange} id="includeImages" name="includeImages" checked={this.state.includeImages} /> Images</label></li>
                  <li><label htmlFor="includeAudio"><input type="checkbox" onChange={this.handleChange} id="includeAudio" name="includeAudio" checked={this.state.includeAudio} /> Audio</label></li>
                  <li><label htmlFor="includeVideo"><input type="checkbox" onChange={this.handleChange} id="includeVideo" name="includeVideo" checked={this.state.includeVideo} /> Video</label></li>
                  <li><label htmlFor="includeDocuments"><input type="checkbox" onChange={this.handleChange} id="includeDocuments" name="includeDocuments" checked={this.state.includeDocuments} /> Documents (.pdf, .doc, .pptx, etc.)</label></li>
                </ul>
                <div className="label date-filter">Date Archived</div>
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
                      <DropdownButton id="session-filter" title={this.state.session ? this.state.session : "Select a session"} onSelect={this.selectSession}>
                        {
                          collection.get('recordings').map(rec => <MenuItem key={rec.get('id')} eventKey={rec.get('id')} active={this.state.session === rec.get('id')}>{rec.get('id')}</MenuItem>)
                        }
                      </DropdownButton>
                  }
                </div>
                <div className="actions">
                  <button type="button" className="button-link" onClick={this.reset}>Reset to Defaults</button>
                  <button type="button" className="rounded" onClick={this.search}>Search</button>
                </div>
              </section>
            </OutsideClick>
        }
      </div>
    );
  }
}


export default Searchbox;
