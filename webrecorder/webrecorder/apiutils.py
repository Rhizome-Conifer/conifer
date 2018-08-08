# standard library imports
import json
import datetime


class CustomJSONEncoder(json.JSONEncoder):
    """Customized JSON encoder."""

    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return str(obj.strftime("%Y-%m-%d %H:%M:%S"))
        return json.JSONEncoder.default(self, obj)
