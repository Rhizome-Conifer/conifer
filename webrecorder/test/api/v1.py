from bottle import Bottle, get, post, request, response, run

from random import randint
import re
import time

# Li'l datastore
COLLECTIONS =  { "@anon" :
                { "id": "anonymous", "title": "Anonymous",
                "description": "This is a temporary anonymous collection", "size_remaining": 524288000,
                "recordings": [] },

                 "proust4eva":
                {"id": "proust-over-http", "title": "Proust over http",
                "description": "What would Proust post?", "size_remaining": 143211060,
                "recordings": [{"id": "a-la-recherche", "title": "À la recherche",
                            "created_at": "2015010203000000", "updated_at": "2015010303000000",
                            "size": 124288000},
                            {"id": "du-temps-perdu", "title": "du temps perdu",
                            "created_at": "2016010203000000", "updated_at": "2016010303000000",
                            "size": 256788940}]}
                }

PAGES = { "a-la-recherche": [{"url": "http://twitter.com/proustfan36", "title": "Twitter - proustfan36", "timestamp": "2013140000000000"},
                            {"url": "http://societyofmadelineeaters.com", "title": "The Society of Madeline Eaters", "timestamp": "2015020304000000"}],
          "du-temps-perdu": [{"url": "http://involuntarymemory.guru", "title": "Involuntary Memory", "timestamp": "2016050607000000"}] }


# Bottle + CORS, CORStesy of https://gist.github.com/richard-flosi/3789163
app = Bottle()

@app.hook('after_request')
def enable_cors():
    """
    You need to add some headers to each request.
    Don't use the wildcard '*' for Access-Control-Allow-Origin in production.
    """
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'

# GET /recordings
@app.get('/api/v1/recordings')
def recordings_index():
    username = request.query.u

    if not valid_user(username):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(username, request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    return {"recordings" : COLLECTIONS[username] }

# POST /recordings
@app.post('/api/v1/recordings')
def create_recording():
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.u, request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    title = request.forms.get('title')
    id = id_from_title(title)

    recording = get_recording_by_user_and_id(request.query.u, id)
    if recording:
        response.status = 400
        return  {"status": "AlreadyExists",
                 "recording": recording}
    else:
        COLLECTIONS[request.query.u]['recordings'].append(
            {"id": id, "title": title, "created_at": int(round(time.time() * 1000)),
             "modified_at": int(round(time.time() * 1000)), "size": 0})
        response.status = 200
        return {"status": "success",
                "recording": get_recording_by_user_and_id(request.query.u, id)}

# GET /recordings/<id>
@app.get('/api/v1/recordings/<id>')
def get_recording(id):
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    recording = get_recording_by_user_and_id(request.query.u, id)
    if recording:
        response.status = 200
        return recording
    else:
        response.status = 404
        return {"error_message" : "Recording not found"}

# @delete('/api/v1/recordings/<id>')
# @get('/api/v1/recordings/<id>/download')

# GET /api/v1/recordings/<id>/pages
@app.get('/api/v1/recordings/<id>/pages')
def get_pages(id):
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    if get_recording_by_user_and_id(request.query.u, id):
        response.status = 200
        return {"pages": PAGES[id]}
    else:
        response.status = 404
        return {"error_message" : "Recording not found"}

# POST /api/v1/recordings/<id>/pages'
@app.post('/api/v1/recordings/<id>/pages')
def post_pages(id):
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    if get_recording_by_user_and_id(request.query.u, id):
        url = request.forms.get('url')
        page = get_page_by_url(id, url)

        if page:
            response.status = 200
            return {"status" : "success", "message": "Adding to existing page"}
        else:
            PAGES[id].append({"url": url, "title": "", "timestamp": int(round(time.time() * 1000))})
            return {"status" : "success" }
        page = PAGES[id]
        response.status = 200
    else:
        response.status = 404
        return {"error_message" : "Recording not found"}


# @get('/api/v1/collections')
# @post('/api/v1/collections')
# @get('/api/v1/collections/<id>')
# @delete('/api/v1/collections/<id>')
# @get('/api/v1/collections/<id>/download')

# Validation
def valid_user(username):
    return username in COLLECTIONS.keys()

def valid_collection(username, collection):
    return collection == COLLECTIONS[username]['id']

# Utilities
def id_from_title(title):
    p = re.compile('[\s]')
    return p.sub('-', title)

def title_from_id(id):
    p = re.compile('[-]')
    return p.sub(' ', id)

def get_recordings_by_collection(username, collection):
    return COLLECTIONS[username][collection]['recordings']

def get_recording_by_user_and_id(username, recording):
    if len(list(filter((lambda rec: recording == rec['id']), COLLECTIONS[username]['recordings']))) == 0:
        return None
    else:
        return list(filter((lambda rec: recording == rec['id']), COLLECTIONS[username]['recordings']))[0]

def get_page_by_url(recording, url):
    if len(list(filter((lambda page: url == page['url']), PAGES[recording]))) == 0:
        return None
    else:
        return list(filter((lambda page: url == page['url']), PAGES[recording]))

# run(host='localhost', port=8080, debug=True)

# More from Bottle + CORS, CORStesy of https://gist.github.com/richard-flosi/3789163
if __name__ == '__main__':
    from optparse import OptionParser
    parser = OptionParser()
    parser.add_option("--host", dest="host", default="0.0.0.0",
                      help="hostname or ip address", metavar="host")
    parser.add_option("--port", dest="port", default=8080,
                      help="port number", metavar="port")
    (options, args) = parser.parse_args()
    run(app, host=options.host, port=int(options.port))
