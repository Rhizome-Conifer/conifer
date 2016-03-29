from bottle import get, post, request, run

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
# @post('/api/v1/recordings')
# @get('/api/v1/recordings/<id>')
# @delete('/api/v1/recordings/<id>')
# @get('/api/v1/recordings/<id>/download')

# @get('/api/v1/recordings/<id>/pages')
# @post('/api/v1/recordings/<id>/pages')

# @get('/api/v1/collections')
# @post('/api/v1/collections')
# @get('/api/v1/collections/<id>')
# @delete('/api/v1/collections/<id>')
# @get('/api/v1/collections/<id>/download')

run(host='localhost', port=8080, debug=True)