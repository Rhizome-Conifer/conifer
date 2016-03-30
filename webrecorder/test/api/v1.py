from bottle import get, post, request, response, run

from random import randint
import re

# GET /recordings
@get('/api/v1/recordings')
def recordings_index():
    user = request.query.user
    collection = request.query.collection

    return { "recordings": [{"id": "a-la-recherche", "title": "À la recherche",
                            "created_at": "2016010203000000", "updated_at": "2016010203000000",
                            "size": 1000000},
                            {"id": "du-temps-perdu", "title": "du temps perdu",
                            "created_at": "2016010203000000", "updated_at": "2016010203000000",
                            "size": 1000000}]}

# POST /recordings
@post('/api/v1/recordings')
def create_recording():
    title = request.forms.get('title')
    id = id_from_title(title)

    if is_valid(id):
        response.status = 200
        return {"status": "success",
                "recording": {"id": id, "title": title, "created_at": "2016010203000000",
                              "modified_at": "2016010203000000", "size": 0}}
    else:
        response.status = 400
        return  {"status": "AlreadyExists",
                 "recording": {"id": id, "title": title,
                 "created_at": "2016010203000000", "updated_at": "2016010203000000", "size": 100000}}

# GET /recordings/<id>
@get('/api/v1/recordings/<id>')
def get_recording(id):
    user = request.query.user
    collection = request.query.collection

    title = title_from_id(id)
    return {"id": id, "title": title, "created_at": "2016010203000000", "updated_at": "2016010203000000", "size": 87000}


# @delete('/api/v1/recordings/<id>')
# @get('/api/v1/recordings/<id>/download')

# GET /api/v1/recordings/<id>/pages
@get('/api/v1/recordings/<id>/pages')
def get_pages(id):
    return {"pages": [{"url": "http://twitter.com/proustfan36", "title": "Twitter - proustfan36", "timestamp": "2013140000000000"},
                      {"url": "http://societyofmadelineeaters.com", "title": "The Society of Madeline Eaters", "timestamp": "2016010203000000"}] }

# @post('/api/v1/recordings/<id>/pages')

# @get('/api/v1/collections')
# @post('/api/v1/collections')
# @get('/api/v1/collections/<id>')
# @delete('/api/v1/collections/<id>')
# @get('/api/v1/collections/<id>/download')

# Utilities
def is_valid(id):
    if randint(0,1) == 0:
        return True
    else:
        return False

def id_from_title(title):
    p = re.compile('[\s]')
    return p.sub('-', title)

def title_from_id(id):
    p = re.compile('[-]')
    return p.sub(' ', id)

run(host='localhost', port=8080, debug=True)