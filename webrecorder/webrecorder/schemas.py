# standard library imports
import json
from datetime import datetime

# third party imports
from marshmallow import (
    fields, Schema, validates_schema, ValidationError
)

# library specific imports
from webrecorder.redisman import RedisDataManager as RDM


# key indicating whether a collection is public
public_key = RDM.READ_PREFIX + RDM.PUBLIC


class BaseSchema(Schema):
    """Base schema."""

    class Meta:
        """Metadata schema.

        :cvar bool ordered: n.s.
        """
        ordered = True


class UserSchema(BaseSchema):
    """Webrecorder user schema.

    :cvar String username: username
    :cvar Email email: e-mail address
    :cvar Function name: n.s.
    :cvar DateTime created: user registration date
    :cvar DateTime last_login: last login date
    :cvar String role: user role
    :cvar Nested space_utilization: n.s.
    :cvar Nested collections: n.s.
    """
    username = fields.String(required=True)
    email = fields.Email(required=True, load_from='email_addr')
    name = fields.Function(deserialize=lambda x: json.loads(x).get('name', ''),
                           load_from='desc')
    created = fields.DateTime(load_from='creation_date')
    last_login = fields.DateTime()
    role = fields.String(required=True)

    space_utilization = fields.Nested('SpaceUtilization')
    collections = fields.Nested('CollectionSchema', many=True)

    class Meta(BaseSchema.Meta):
        """User metadata schema.

        :cvar str dateformat: date format string
        """
        dateformat = '%Y-%m-%d %H:%M:%S.%f'


class TempUserSchema(BaseSchema):
    """Temporal user schema.

    :cvar String username: username
    :cvar Function created: n.s.
    :cvar DateTime removal: n.s.
    :cvar Nested space_utilization: n.s.
    """
    username = fields.String(required=True)
    created = fields.Function(
        deserialize=lambda x: datetime.fromtimestamp(int(x)),
        load_from='created_at'
    )
    removal = fields.DateTime()

    space_utilization = fields.Nested('SpaceUtilization')


class UserUpdateSchema(UserSchema):
    """User update schema.

    :cvar Number max_size: maximum size
    """
    max_size = fields.Number()


class NewUserSchema(UserSchema):
    """User schema (includes username and password validation).

    :cvar String password: password
    """
    password = fields.String()

    @validates_schema
    def custom_validation(self, data):
        """Username and password validation.

        :param dict data: input
        """

        if 'password' not in data:
            raise ValidationError('`password` is a required field.')

        if not RDM.PASS_RX.match(data['password']):
            raise ValidationError('Passwords must be at least 8 characters '
                                  'long with lowercase, uppercase, and either '
                                  'digits or symbols.')

        if (
                not RDM.USER_RX.match(data['username']) or
                data['username'] in RDM.RESTRICTED_NAMES
        ):
            raise ValidationError('Invalid username..')


class SpaceUtilization(BaseSchema):
    """User disk space schema.

    :cvar Number available: available disk space
    :cvar Number total: total disk space
    :cvar Number used: disk space in use
    """
    available = fields.Number()
    total = fields.Number()
    used = fields.Number()


class CollectionSchema(BaseSchema):
    """User collection schema.

    :cvar String id: collection ID
    :cvar String title: collection title
    :cvar String description: collection description
    :cvar Url download_url: collection URL
    :cvar Number size: collection size
    :cvar Boolean public: whether the collection is public or not
    :cvar Nested recordings: collection records
    """
    id = fields.String(required=True)
    title = fields.String(required=True)
    created = fields.Number(load_from='created_at')
    description = fields.String(load_from='desc')
    download_url = fields.Url()
    size = fields.Number()
    public = fields.Boolean(load_from=public_key, missing=False)

    recordings = fields.Nested('RecordingSchema', many=True)


class RecordingSchema(BaseSchema):
    """Record schema.

    :cvar String id: record ID
    :cvar String title: record title
    :cvar Number size: record size
    :cvar Url download_url: record URL
    :cvar String description: record description
    :cvar Number updated: record update date
    :cvar Nested pages: record pages
    """
    id = fields.String(required=True)
    title = fields.String()
    size = fields.Number()
    download_url = fields.Url()
    description = fields.String(load_from='desc')
    created = fields.Number(load_from='created_at')
    updated = fields.Number(load_from='updated_at')

    pages = fields.Nested('PageSchema', many=True)


class PageSchema(BaseSchema):
    """Page schema.

    :cvar String title: page title
    :cvar Url url: page URL
    :cvar Number timestamp: page date
    :cvar String browser_id: browser ID
    """
    title = fields.String()
    url = fields.Url()
    timestamp = fields.Number()
    browser_id = fields.String()
