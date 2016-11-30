import json

from datetime import datetime

from marshmallow import (Schema, fields, validate, ValidationError,
                         validates_schema)

from webrecorder.redisman import RedisDataManager as RDM


# key indicating whether a collection is public
public_key = RDM.READ_PREFIX + RDM.PUBLIC


class BaseSchema(Schema):

    class Meta:
        ordered = True


class UserSchema(BaseSchema):
    """Schema to describe a webrecorder user."""
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
        dateformat = '%Y-%m-%d %H:%M:%S.%f'


class TempUserSchema(BaseSchema):
    username = fields.String(required=True)
    created = fields.Function(deserialize=lambda x: datetime.fromtimestamp(int(x)),
                              load_from='created_at')
    removal = fields.DateTime()

    space_utilization = fields.Nested('SpaceUtilization')


class UserUpdateSchema(UserSchema):
    """Schema describing available fields for update in the admin panel."""
    max_size = fields.Number()


class NewUserSchema(UserSchema):
    """Thin extension of `UserSchema` including username and
       password validation.
    """
    password = fields.String()

    @validates_schema
    def custom_validation(self, data):
        """Custom validation for user signup"""

        if 'password' not in data:
            raise ValidationError('`password` is a required field.')

        if not RDM.PASS_RX.match(data['password']):
            raise ValidationError('Passwords must be at least 8 characters '
                                  'long with lowercase, uppercase, and either '
                                  'digits or symbols.')

        if not RDM.USER_RX.match(data['username']) or data['username'] in RDM.RESTRICTED_NAMES:
            raise ValidationError('Invalid username..')


class SpaceUtilization(BaseSchema):
    """Schema describing user disk space utilization."""
    available = fields.Number()
    total = fields.Number()
    used = fields.Number()


class CollectionSchema(BaseSchema):
    """Schema describing a user's collection"""
    id = fields.String(required=True)
    title = fields.String(required=True)
    created = fields.Number(load_from='created_at')
    description = fields.String(load_from='desc')
    download_url = fields.Url()
    size = fields.Number()
    public = fields.Boolean(load_from=public_key, missing=False)

    recordings = fields.Nested('RecordingSchema', many=True)


class RecordingSchema(BaseSchema):
    """Schema describing a recording within a collection"""
    id = fields.String(required=True)
    title = fields.String()
    size = fields.Number()
    download_url = fields.Url()
    description = fields.String(load_from='desc')
    created = fields.Number(load_from='created_at')
    updated = fields.Number(load_from='updated_at')

    pages = fields.Nested('PageSchema', many=True)


class PageSchema(BaseSchema):
    """Schema describing a page within a recording"""
    title = fields.String()
    url = fields.Url()
    timestamp = fields.Number()
    browser_id = fields.String()
