from bottle import get, post, request, run

# Get list of recordings
@get('/api/v1/recordings')
def recordings_index():
	user = request.query.user
	collection = request.query.collection

	return {"hello": "world"}

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