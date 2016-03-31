from bottle import get, post, request, response, run

from random import randint
import re
import time

# Li'l datastore
USERNAME = "proust4eva"
COLLECTION =  {"id": "proust-over-http", "title": "Proust over http",
                "description": "What would Proust post?", "size_remaining": 143211060,
                "recordings": [{"id": "a-la-recherche", "title": "À la recherche",
                            "created_at": "2015010203000000", "updated_at": "2015010303000000",
                            "size": 124288000},
                            {"id": "du-temps-perdu", "title": "du temps perdu",
                            "created_at": "2016010203000000", "updated_at": "2016010303000000",
                            "size": 256788940}]}
PAGES = { "a-la-recherche": [{"url": "http://twitter.com/proustfan36", "title": "Twitter - proustfan36", "timestamp": "2013140000000000"},
                            {"url": "http://societyofmadelineeaters.com", "title": "The Society of Madeline Eaters", "timestamp": "2015020304000000"}],
          "du-temps-perdu": [{"url": "http://involuntarymemory.guru", "title": "Involuntary Memory", "timestamp": "2016050607000000"}] }

# GET /recordings
@get('/api/v1/recordings')
def recordings_index():
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    return {"recordings" : COLLECTION['recordings']}

# POST /recordings
@post('/api/v1/recordings')
def create_recording():
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    title = request.forms.get('title')
    id = id_from_title(title)

    recording = get_recording_by_id(id)
    if recording:
        response.status = 400
        return  {"status": "AlreadyExists",
                 "recording": recording}
    else:
        COLLECTION['recordings'].append({"id": id, "title": title, "created_at": int(round(time.time() * 1000)),
                              "modified_at": int(round(time.time() * 1000)), "size": 0})
        response.status = 200
        return {"status": "success",
                "recording": get_recording_by_id(id)}

# GET /recordings/<id>
@get('/api/v1/recordings/<id>')
def get_recording(id):
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    recording = get_recording_by_id(id)
    if recording:
        response.status = 200
        return recording
    else:
        response.status = 404
        return {"error_message" : "Recording not found"}

# @delete('/api/v1/recordings/<id>')
# @get('/api/v1/recordings/<id>/download')

# GET /api/v1/recordings/<id>/pages
@get('/api/v1/recordings/<id>/pages')
def get_pages(id):
    if not valid_user(request.query.u):
        response.status = 404
        return {"error_message": "Username not found"}

    if not valid_collection(request.query.c):
        response.status = 404
        return {"error_message": "Collection not found"}

    if get_recording_by_id(id):
        response.status = 200
        return {"pages": PAGES[id]}
    else:
        response.status = 404
        return {"error_message" : "Recording not found"}

# @post('/api/v1/recordings/<id>/pages')
# @get('/api/v1/collections')
# @post('/api/v1/collections')
# @get('/api/v1/collections/<id>')
# @delete('/api/v1/collections/<id>')
# @get('/api/v1/collections/<id>/download')

# Validation
def valid_user(username):
    return username == USERNAME

def valid_collection(collection):
    return collection == COLLECTION['id']

# Utilities
def id_from_title(title):
    p = re.compile('[\s]')
    return p.sub('-', title)

def title_from_id(id):
    p = re.compile('[-]')
    return p.sub(' ', id)

def get_recording_by_id(id):
    if len(list(filter((lambda rec: id == rec['id']), COLLECTION['recordings']))) == 0:
        return None
    else:
        return list(filter((lambda rec: id == rec['id']), COLLECTION['recordings']))[0]

run(host='localhost', port=8080, debug=True)