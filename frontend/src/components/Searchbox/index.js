import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import DatePicker from 'react-datepicker';
import querystring from 'querystring';
import { Button, DropdownButton, FormControl, InputGroup, MenuItem } from 'react-bootstrap';

import { columns } from 'config';

import { LoaderIcon, SearchIcon, XIcon } from 'components/icons';

import './style.scss';


class Searchbox extends PureComponent {
  static propTypes = {
    collection: PropTypes.object,
    clear: PropTypes.func,
    location: PropTypes.object,
    query: PropTypes.func,
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
      session,
      startDate
    };

    if (props.location.search) {
      const qs = querystring.parse(props.location.search.replace(/^\?/, ''));

      if (qs.search) {
        props.search(qs);
        search = qs.search;
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

      if (qs.daterange) {
        startDate = qs.startDate;
        endDate = qs.endDate;
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
      session,
      startDate
    };

    this.labels = {
      anytime: 'Anytime',
      daterange: 'Between specific dates',
      session: 'During a specific capture session'
    };
  }

  componentDidUpdate(prevProps) {
    // check for searched prop being cleared
    if (prevProps.searched && !this.props.searched) {
      this.setState({ search: '' });
    }
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

    const queryColumn = columns.find(c => evt.target.value.startsWith(`${c}:`));
    if (queryColumn) {
      this.props.query(queryColumn);
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

    window.history.replaceState({}, '', `?${querystring.stringify(searchParams)}`);
    this.props.search(searchParams);
  }

  clear = (evt) => {
    const { collection } = this.props;
    evt.stopPropagation();

    window.history.replaceState({}, '', '?search=');
    this.setState({ search: '' });
    this.props.clear(collection.get('owner'), collection.get('id'));
  }

  reset = () => {
    this.setState({ ...this.initialValues });
  }

  selectSession = session => this.setState({ session })

  setEndDate = d => this.setState({ endDate: d })

  setStartDate = d => this.setState({ startDate: d })

  toggleAdvancedSearch = () => {
    this.setState({ options: !this.state.options });
  }

  render() {
    const { collection, searching, searched } = this.props;
    const { date } = this.state;

    return (
      <div className="search-box">
        <InputGroup bsClass="input-group search-box" title="Search">
          <div className="input-wrapper">
            <FormControl aria-label="filter" bsSize="sm" onKeyUp={this.keyUp} onChange={this.handleChange} name="search" value={this.state.search} autoComplete="off" placeholder="Filter" />
            <button className="borderless advanced-options" onClick={this.toggleAdvancedSearch} type="button">options</button>
          </div>
          <InputGroup.Button>
            {
              searched ?
                <Button aria-label="clear" bsSize="sm" onClick={this.clear} type="button"><XIcon /></Button> :
                <Button aria-label="search" bsSize="sm" onClick={this.search} disabled={searching} type="button">{searching ? <LoaderIcon /> : <SearchIcon />}</Button>
            }
          </InputGroup.Button>
        </InputGroup>

        {
          this.state.options &&
            <section className="adv-search-filters">
              <button className="borderless close-adv" onClick={this.toggleAdvancedSearch} type="button"><XIcon /></button>
              <div className="filter">
                <div className="label">Include File Types</div>
                <ul>
                  <li><label htmlFor="includeWebpages"><input type="checkbox" onChange={this.handleChange} id="includeWebpages" name="includeWebpages" checked={this.state.includeWebpages} /> Webpages</label></li>
                  <li><label htmlFor="includeImages"><input type="checkbox" onChange={this.handleChange} id="includeImages" name="includeImages" checked={this.state.includeImages} /> Images</label></li>
                  <li><label htmlFor="includeAudio"><input type="checkbox" onChange={this.handleChange} id="includeAudio" name="includeAudio" checked={this.state.includeAudio} /> Audio</label></li>
                  <li><label htmlFor="includeVideo"><input type="checkbox" onChange={this.handleChange} id="includeVideo" name="includeVideo" checked={this.state.includeVideo} /> Video</label></li>
                  <li><label htmlFor="includeDocuments"><input type="checkbox" onChange={this.handleChange} id="includeDocuments" name="includeDocuments" checked={this.state.includeDocuments} /> Documents (.pdf, .doc, .pptx, etc.)</label></li>
                </ul>
              </div>
              <div className="filter date-filter">
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
                      <DropdownButton id="session-filter" title={this.state.session ? this.state.session : "Select a session"} onSelect={this.selectSession}>
                        {
                          collection.get('recordings').map(rec => <MenuItem key={rec.get('id')} eventKey={rec.get('id')} active={this.state.session === rec.get('id')}>{rec.get('id')}</MenuItem>)
                        }
                      </DropdownButton>
                  }
                </div>
              </div>
              <div className="actions">
                <button type="button" className="button-link" onClick={this.reset}>Reset to Defaults</button>
                <button type="button" className="rounded" onClick={this.search}>Search</button>
              </div>
            </section>
        }
      </div>
    );
  }
}


export default Searchbox;
